import { GoogleGenAI, Modality, GenerateContentResponse, Type } from "@google/genai";
import { PostContent, PostResult } from "../types";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey });

// Declarations for client-side libraries loaded via script tags
declare const mammoth: any;
declare const XLSX: any;


export const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const aspectRatioDescriptions: Record<string, string> = {
    '4:5': 'formato de retrato vertical (4 por 5)',
    '1:1': 'formato quadrado (1 por 1)',
    '9:16': 'formato de stories vertical (9 por 16)',
    '16:9': 'formato de paisagem horizontal (16 por 9)',
    '4:3': 'formato de apresentação horizontal (4 por 3)',
    '3:4': 'formato de pin vertical (3 por 4)',
};

const createImageGenPrompt = (postContent: PostContent, styleImageFile: File | null, logoImageFile: File | null, aspectRatio: string, withText: boolean): string => {
    const aspectRatioDescription = aspectRatioDescriptions[aspectRatio] ?? `proporção de ${aspectRatio}`;

    const textInstruction = withText 
        ? `
**[REGRA CRÍTICA #2 - INCLUSÃO DE TEXTO]**
- Incorpore o seguinte texto de forma criativa, legível e elegante na imagem:
  - **Título Principal:** "${postContent.title}"
  - **Subtítulo (menor):** "${postContent.subtitle}"
- A tipografia deve ser profissional e complementar ao estilo visual. O texto deve ser o ponto focal, mas integrado harmonicamente.
`
        : `
**[REGRA CRÍTICA #2 - SEM TEXTO]**
A imagem final NÃO DEVE conter NENHUM texto, NENHUMA letra, NENHUMA palavra, NENHUMA marca d'água. Deve ser puramente visual.
`;

    return `
**[REGRA TÉCNICA #1 - FORMATO DE SAÍDA - PRIORIDADE MÁXIMA]**
A proporção de aspecto da imagem final DEVE SER EXATAMENTE **${aspectRatio} (${aspectRatioDescription})**.
Esta é a instrução mais importante. É um parâmetro técnico, não uma sugestão criativa.
**IGNORE COMPLETAMENTE a proporção de aspecto e as dimensões de TODAS as imagens de referência fornecidas (tanto a imagem de estilo quanto a imagem do logotipo).**
A única fonte de verdade para o formato da imagem final é esta regra.

---

**TAREFA: Criar uma imagem para um post de advocacia (português do Brasil).**

${textInstruction}

**PASSO 1: TEMA DA IMAGEM**
- O tema central da imagem deve ser uma representação visual abstrata e conceitual do seguinte conteúdo:
  - Título do post: "${postContent.title}"
  - Assunto principal: "${postContent.copy.substring(0, 200)}..." 
- A imagem deve evocar profissionalismo, seriedade e confiança, alinhada a um escritório de advocacia.

**PASSO 2: ESTILO VISUAL**
${styleImageFile 
    ? "- Use a primeira imagem de referência como INSPIRAÇÃO VISUAL (estilo, cores, composição). A proporção desta imagem de referência é irrelevante e DEVE SER IGNORADA." 
    : `- Crie um fundo visual com base no seguinte estilo detalhado: Estética jurídica de luxo, ambiente escuro, profundidade de campo rasa, iluminação cinematográfica discreta, luz principal quente + luz de contorno sutil, detalhes em dourado e partículas douradas suaves, texturas ricas, pretos foscos, um toque de latão envelhecido. Paleta de cores: #0B0B0F, #1A1A1F, #C8A35F, #D4AF37, #F5F2E8, #8C6B3E. Adicione granulação de filme fina, vinheta leve, brilho suave apenas nos elementos dourados, realces brilhantes controlados. Composição usando a regra dos terços, espaço negativo generoso, toques de desfoque em primeiro plano, bokeh de fundo. Editorial, elegante, realista, premium. Sem neon, sem desenho animado, sem alta saturação. Foco seletivo, chiaroscuro dramático, bokeh de fundo, ultra-detalhe, assunto nítido, brilho de bom gosto, gradação de cores coesa.`
}

**PASSO 3: LOGOTIPO (se fornecido)**
${logoImageFile 
    ? `- Pegue o logotipo da ${styleImageFile ? 'segunda' : 'primeira'} imagem de referência e posicione-o discretamente em um canto inferior. A proporção desta imagem de referência do logotipo é irrelevante e DEVE SER IGNORADA para a composição final.`
    : "- Não adicione nenhum logotipo."
}
`;
};

const generateSingleImage = async (prompt: string, imageParts: any[]): Promise<string> => {
    const allParts = [{ text: prompt }, ...imageParts];
    
    const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: allParts },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    const candidate = imageResponse.candidates?.[0];

    if (!candidate) {
        throw new Error("A API não retornou candidatos para a geração de imagem.");
    }
    
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`A geração de imagem foi bloqueada. Motivo: ${candidate.finishReason}. Tente reformular o tema do post.`);
    }

    if (!candidate.content || !candidate.content.parts) {
         throw new Error("A resposta da IA não continha o conteúdo esperado para a imagem.");
    }

    for (const part of candidate.content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }
    throw new Error("Nenhuma imagem encontrada na resposta da geração do post.");
};


export const generateImages = async (postContent: PostContent, styleImageFile: File | null, logoImageFile: File | null, aspectRatio: string): Promise<{imageUrlWithText: string; imageUrlWithoutText: string}> => {
    const imageParts = [];
    if (styleImageFile) {
        imageParts.push(await fileToGenerativePart(styleImageFile));
    }
    if (logoImageFile) {
        imageParts.push(await fileToGenerativePart(logoImageFile));
    }

    const promptWithText = createImageGenPrompt(postContent, styleImageFile, logoImageFile, aspectRatio, true);
    const promptWithoutText = createImageGenPrompt(postContent, styleImageFile, logoImageFile, aspectRatio, false);

    const [imageUrlWithText, imageUrlWithoutText] = await Promise.all([
        generateSingleImage(promptWithText, imageParts),
        generateSingleImage(promptWithoutText, imageParts),
    ]);

    return { imageUrlWithText, imageUrlWithoutText };
};


export const generatePost = async (theme: string, styleImageFile: File | null, logoImageFile: File | null, aspectRatio: string): Promise<PostResult> => {
    // Step 1: Generate Text Content
    const textGenPrompt = `
        Você é um especialista em marketing de conteúdo para o setor jurídico, com foco em direito do trabalho.
        Sua tarefa é criar o conteúdo de texto para um post de mídia social com base no seguinte tema.
        O tom deve ser profissional, informativo e sóbrio, em conformidade com o Código de Ética da OAB (sem mercantilização).
        O idioma deve ser português do Brasil.
        Tema: "${theme}"
    `;
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Um título atraente e curto para o post (máximo 6-8 palavras)." },
            subtitle: { type: Type.STRING, description: "Um subtítulo curto e informativo (máximo 10-12 palavras)." },
            copy: { type: Type.STRING, description: "A legenda principal do post (cerca de 2-3 parágrafos)." },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Uma lista de 5-7 hashtags relevantes em português sobre direito do trabalho." },
            seoKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Uma lista de 3-5 palavras-chave de SEO para otimização de blog sobre direito do trabalho." },
        },
         required: ["title", "subtitle", "copy", "hashtags", "seoKeywords"]
    };

    const textResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: textGenPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema,
        }
    });
    
    let postContent: PostContent;
    try {
        const responseText = textResponse.text;
        if (!responseText) {
            const finishReason = textResponse.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
                throw new Error(`A geração de texto foi bloqueada. Motivo: ${finishReason}. Tente reformular o tema.`);
            }
            throw new Error("A resposta de texto da IA estava vazia.");
        }
        postContent = JSON.parse(responseText);
    } catch(e: any) {
        console.error("Erro ao processar a resposta de texto da IA:", textResponse, e);
        const message = e.message.includes("bloqueada") 
            ? e.message 
            : "Falha ao analisar o conteúdo do post gerado. A resposta da IA pode não ser um JSON válido.";
        throw new Error(message);
    }

    // Step 2: Generate Images using the generated text and optional input images
    const { imageUrlWithText, imageUrlWithoutText } = await generateImages(postContent, styleImageFile, logoImageFile, aspectRatio);

    return { postContent, imageUrlWithText, imageUrlWithoutText };
};

export const complexQuery = async (prompt: string): Promise<string> => {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });
    // Add check for finishReason to ensure the response is valid
    if (response.candidates?.[0]?.finishReason && response.candidates?.[0]?.finishReason !== 'STOP') {
        throw new Error(`A geração foi bloqueada. Motivo: ${response.candidates[0].finishReason}.`);
    }
    return response.text;
};

const isWordFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith('.docx');
};
const isExcelFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith('.xlsx') || name.endsWith('.xls');
};

export const generatePeticaoInicial = async (documentos: File[], modeloFile: File | null): Promise<string> => {
    let modeloContent: string | null = null;
    if (modeloFile) {
        try {
            if (isWordFile(modeloFile)) {
                const arrayBuffer = await modeloFile.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                modeloContent = result.value;
            } else { // Assume .txt or other readable text format
                modeloContent = await modeloFile.text();
            }
        } catch (err: any) {
            throw new Error(`Falha ao processar o arquivo de modelo '${modeloFile.name}'. Verifique se o arquivo não está corrompido e se o formato é suportado (.docx, .txt).`);
        }
    }

    const caseFiles = [...documentos];

    const nativeFiles: File[] = [];
    const filesToConvert: File[] = [];
    
    caseFiles.forEach(file => {
        if (!file) return;
        if (isWordFile(file) || isExcelFile(file)) {
            filesToConvert.push(file);
        } else {
            nativeFiles.push(file);
        }
    });

    let extractedTexts = '';

    // Process all convertible files
    if (filesToConvert.length > 0) {
        const textPromises = filesToConvert.map(async (file) => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                let textContent = '';
                
                if (isWordFile(file)) {
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    textContent = result.value;
                } 
                else if (isExcelFile(file)) {
                    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                    let fullSheetText = '';
                    workbook.SheetNames.forEach((sheetName: string) => {
                        fullSheetText += `\n--- Planilha: ${sheetName} ---\n`;
                        const worksheet = workbook.Sheets[sheetName];
                        const csvData = XLSX.utils.sheet_to_csv(worksheet);
                        fullSheetText += csvData;
                    });
                    textContent = fullSheetText;
                }
                return `\n\n--- INÍCIO DO CONTEÚDO DO ARQUIVO: ${file.name} ---\n${textContent}\n--- FIM DO CONTEÚDO DO ARQUIVO: ${file.name} ---\n`;
            } catch (err: any) {
                 const message = err.message || 'não foi possível extrair o conteúdo';
                 throw new Error(`Falha ao processar o arquivo '${file.name}': ${message}. Verifique se o arquivo não está corrompido e se o formato é .docx (para Word).`);
            }
        });
        const texts = await Promise.all(textPromises);
        extractedTexts = texts.join('');
    }

    let prompt = ``;
    if (modeloContent) {
        const preservedTextBlocks: string[] = [];
        const lockedRegex = /\$\$LOCKED START\$\$(.*?)\$\$LOCKED END\$\$/gs;
        let match;
        
        // Ensure modeloContent is a string before calling exec
        const contentAsString = String(modeloContent);
        while ((match = lockedRegex.exec(contentAsString)) !== null) {
            preservedTextBlocks.push(match[1].trim());
        }

        prompt = `
            Você é um assistente jurídico altamente qualificado e também um advogado trabalhista muito experiente. Sua tarefa é redigir uma Petição Inicial completa e formal.
            
            INSTRUÇÃO DE INÍCIO (PRIORIDADE MÁXIMA): Comece a resposta DIRETAMENTE com o texto da petição, iniciando pelo ENDEREÇAMENTO (se presente no modelo) ou pelo primeiro item do modelo. NÃO inclua NENHUMA frase introdutória, saudação ou qualquer texto antes do início formal do documento, como "Com certeza, aqui está a petição...".

            INSTRUÇÃO CRÍTICA: Um modelo de petição foi fornecido. Você deve seguir a estrutura e o conteúdo deste modelo, preenchendo as informações que faltam com base nos documentos do caso e na entrevista.
            Se uma informação necessária (como nomes, datas, endereços, etc.) não for encontrada nos documentos, use o placeholder [INFORMAÇÃO NÃO ENCONTRADA NO DOCUMENTO].
            
            **INSTRUÇÃO ADICIONAL CRÍTICA:** Antes da seção de pedidos ou do fechamento final da petição, você DEVE adicionar uma nova seção intitulada "CÁLCULO ESTIMADO DOS VALORES DA CAUSA". Nesta seção, você deve detalhar, item por item, os valores estimados para cada verba pleiteada (ex: horas extras, aviso prévio, multa do FGTS, etc.) e, ao final, apresentar a soma total em "VALOR TOTAL ESTIMADO DA CAUSA".

            O modelo contém blocos de texto que DEVEM SER PRESERVADOS na íntegra, sem NENHUMA alteração. Eles já estão no lugar certo no texto do modelo, mas estão listados aqui para sua referência.
            BLOCOS DE TEXTO A SEREM PRESERVADOS:
            ${preservedTextBlocks.map((block, i) => `--- Bloco ${i + 1} ---\n${block}\n--- Fim do Bloco ${i + 1} ---\n`).join('\n')}

            Abaixo está o modelo completo a ser seguido. Use-o como base para a petição final, combinando-o com as informações extraídas dos arquivos de caso.
            --- INÍCIO DO MODELO ---
            ${contentAsString.replace(/\$\$LOCKED START\$\$(.*?)\$\$LOCKED END\$\$/gs, '$1')}
            --- FIM DO MODELO ---
        `;

    } else {
      prompt = `
      Você é um assistente jurídico altamente qualificado e também um advogado trabalhista muito experiente.
      Sua tarefa é redigir uma Petição Inicial completa e formal a partir dos documentos do caso.

      INSTRUÇÃO DE INÍCIO (PRIORIDADE MÁXIMA): Comece a resposta DIRETAMENTE com o texto da petição, iniciando pelo ENDEREÇAMENTO. NÃO inclua NENHUMA frase introdutória, saudação ou qualquer texto antes do início formal do documento, como "Com certeza, aqui está a petição...".

      Analise o texto extraído de arquivos (se houver) e os arquivos PDF/Imagens anexados para obter o contexto completo.
      Se uma informação necessária (como nomes, datas, endereços, etc.) não for encontrada nos documentos, use o placeholder [INFORMAÇÃO NÃO ENCONTRADA NO DOCUMENTO].

      Estruture a petição rigorosamente da seguinte forma:
        1.  **ENDEREÇAMENTO:** "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DA VARA DO TRABALHO DE [CIDADE/UF]".
        2.  **PREÂMBULO:** Qualificação completa do Reclamante e do Reclamado, extraídas dos documentos fornecidas do cliente.
Informações sobre o escritório de Advocacia: 
Escritório Profissional sito à Rua Flávio Roberto Sabbadini, n° 62, Bairro São Vicente, Gravataí/RS, CEP 94155-450, Fone (51) 3012-5755, com endereço eletrônico lucianomk@gmail.com, Celular (WhatsApp) (51) 99917-9974 / (51) 99917-0026.

        3.  **SÍNTESE DO CONTRATO DE TRABALHO:** Um breve resumo dos fatos da relação de emprego.
        4.  **DOS FATOS:** Narre detalhadamente os acontecimentos que levaram à ação.
	    5.  **DO JUÍZO “100% DIGITAL”:** "A Resolução CNJ nº 345/2020, regulamenta a tramitação dos autos em formato integralmente digital, conforme dispõe o artigo 1ª da Resolução supracitada:
Art. 1º. Autorizar a adoção, pelos Tribunais, das medidas necessárias à implementação do “Juízo 100% Digital” no Poder Judiciário. Parágrafo único. No âmbito do “Juízo 100% Digital”, todos os atos processuais serão exclusivamente praticados por meio eletrônico e remoto por intermédio da rede mundial de computadores.
Sendo assim, é facultado ao reclamante optar, no momento da distribuição da reclamatória trabalhista, se deseja a tramitação dos autos sob este formato, conforme artigo 3º da Resolução CNJ nº 345/2020:
Art. 3º. A escolha pelo “Juízo 100% Digital” é facultativa e será exercida pela parte demandante no momento da distribuição da ação, podendo a parte demandada opor-se a essa opção até o momento da contestação.
Dessa forma, em cumprimento ao parágrafo único, do artigo 2º da Resolução CNJ nº 345/2020, no preâmbulo foi indicado o endereço eletrônico e telefone de seus procuradores, a fim de viabilizar as notificações, conforme segue:
Endereço eletrônico dos procuradores: lucianomk@gmail.com
Celular (WhatsApp): (51)99917-9974 / (51) 99917-0026
Ante o exposto, requer seja deferido ao reclamante a tramitação do processo em formato “100% digital”, ocorrendo todos os atos processuais por meio eletrônico e remoto, devendo a parte reclamada ser notificada para informar os seus dados.
"
       6. **DA CONCESSÃO DO BENEFÍCIO DA JUSTIÇA GRATUITA:** O reclamante informa que não possui condições financeiras para arcar com custas processuais e honorárias advocatícios, sem prejuízo do seu sustento próprio e da sua família, com base no art. 5º, inciso LXXIV, da Constituição Federal, bem como do artigo 790, parágrafo 3º, da CLT, e, ainda, amparado pela Lei Federal nº 1.060/50, juntamente à Lei nº 13.105/15.
A referida declaração está em conformidade com o artigo 1º da Lei 7115/83, senão vejamos:
Art. 1º - A declaração destinada a fazer prova de vida, residência, pobreza, dependência econômica, homônima ou bons antecedentes, quando firmada pelo próprio interessado ou por procurador bastante, e sob as penas da Lei, presume-se verdadeira. (grifo meu)
Tal garantia vem esculpida na Lei Maior, que assevera:
Art. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes:

LXXIV – o Estado prestará assistência jurídica integral e gratuita aos que comprovarem insuficiência de recursos.
De acordo com a Lei nº 1.060/50, no seu artigo 4º, basta a afirmação de que não possui condições de arcar com custas e honorários, sem prejuízo próprio e de sua família, na própria petição inicial ou em seu pedido, a qualquer momento do processo, para a concessão do benefício, pelo que nos bastamos do texto da lei, in verbis:
Art. 4º A parte gozará dos benefícios da assistência judiciária, mediante simples afirmação, na própria petição inicial, de que não está em condições de pagar as custas do processo e os honorários de advogado, sem prejuízo próprio ou de sua família.

§ 1º Presume-se pobre, até prova em contrário, quem afirmar essa condição nos termos da lei, sob pena de pagamento até o décuplo das custas judiciais.
Ressalta que o reclamante firmou declaração de pobreza que segue em anexo, a qual declara ser verdadeira, nos termos da lei, estando amparada estas declarações nos artigos 98 e 99, § 3º do Código de Processo Civil e no artigo 374, IV do Código de Processo Civil.
Diante disto, pugna-se pela concessão do Benefício da Justiça GratUita ao reclamante, em razão da Declaração de Pobreza firmada.

	    7. **DA MULTA DO ART. 477 DA CLT** A partir de 11/11/17, com a edição da Lei nº 13.467/17 (mais conhecida como reforma trabalhista), a matéria sofreu sensível alteração. Isso porque o artigo 477, parágrafo 6º, da CLT, passou a exigir a realização de dois atos no prazo de 10 dias da rescisão: o pagamento das verbas rescisórias e a entrega ao empregado de documentos comprobatórios da comunicação da extinção contratual aos órgãos competentes.
Descumprido qualquer um desses requisitos, passou a ser aplicável a multa do parágrafo 8º do mesmo dispositivo do artigo 477 da CLT, cuja redação permaneceu intocada.
No presente caso a reclamada somente oficializou a Baixa na CTPS, homologação do TRCT, entrega da chave e documentação para liberação do FGTS, bem como a entrega das Guias do Seguro-Desemprego fora do prazo legal, infringindo o previsto na nova redação do §6º do artigo 477 da CLT, dispõe que:
§6º A entrega ao empregado de documentos que comprovem a comunicação da extinção contratual aos órgãos competentes bem como o pagamento dos valores constantes do instrumento de rescisão ou recibo de quitação deverão ser efetuados até dez dias contados a partir do término do contrato.” (Redação dada pela Lei nº 13.467, de 2017)
É importante ressaltar que a Reclamada passou mais de 10 (dez) dias do rompimento contratual para realizar entrega dos documentos (baixa na CTPS, TRCT, FGTS). Logo, a não comunicação do rompimento contratual aos órgãos competentes dentro do prazo previsto legalmente por culpa da reclamada, incorre na multa prevista no art. 477, §8º da CLT.
§ 8º - A inobservância do disposto no § 6º deste artigo sujeitará o infrator à multa de 160 BTN, por trabalhador, bem assim ao pagamento da multa a favor do empregado, em valor equivalente ao seu salário, devidamente corrigido pelo índice de variação do BTN, salvo quando, comprovadamente, o trabalhador der causa à mora.” (Incluído pela Lei nº 7.855, de 24.10.1989)
Nesse sentido, é o entendimento do TST:
MULTA DO § 8º DO ART. 477 DA CLT. PAGAMENTO DAS VERBAS RESCISÓRIAS DENTRO DO PRAZO LEGAL. ATRASO NA ENTREGA DA DOCUMENTAÇÃO RESCISÓRIA. RUPTURA CONTRATUAL NA VIGÊNCIA DA LEI 13.467/2017. PENALIDADE DEVIDA. A discussão, no presente, caso consiste em perquirir se é devida a multa do artigo 477, § 8º, da CLT, em face do atraso na entrega da documentação rescisória, apesar de as verbas rescisórias terem sido pagas tempestivamente. De acordo com a nova redação do § 6º do artigo 477 da CLT, promovida pela Lei 13.467/2017 (já vigente na ocasião da rescisão contratual da Obreira), a penalidade do referido dispositivo passou a ser devida não só no caso do atraso no pagamento das verbas rescisórias, mas, também, do atraso na entrega, ao empregado, de documentos que comprovem a comunicação da extinção contratual aos órgãos competentes. Assim, ante a alteração da redação do art. 477, § 6º, da CLT, o entendimento desta Corte é no sentido de que, nos contratos de trabalho rescindidos após a vigência da Lei nº 13.467/2017, é devida a aplicação da multa prevista no § 8º do art. 477 da CLT, tanto nos casos de atraso no pagamento das verbas rescisórias quanto na entrega da documentação que comprova a extinção do contrato de trabalho. No presente caso, embora constatado o pagamento oportuno das verbas rescisórias, houve o descumprimento do prazo estipulado no § 6º do art. 477 da CLT, no que diz respeito à entrega dos documentos alusivos ao término da relação de emprego (guias do seguro-desemprego e do FGTS), incidindo a multa estipulada no § 8º. Não se pode, por interpretação desfavorável, no Direito do Trabalho, reduzir comando ou verba trabalhista. Portanto, constatado o efetivo descumprimento da referida obrigação no prazo legal, devida a condenação da Reclamada ao pagamento da multa do art. 477, § 8º, da CLT. Julgados. Recurso de revista conhecido e provido no aspecto. (RRAg-1001245-64.2019.5.02.0072, 3ª Turma, Relator Ministro Mauricio Godinho Delgado, DEJT 09/08/2024).
Diante do exposto, requer ao MM Juízo que condene a reclamada em favor do reclamante no pagamento da multa prevista no art. 477 da CLT, diante do atraso na entrega da documentação rescisória.

        8.  **DO DIREITO:** Fundamente cada pedido com a legislação (CLT), doutrina e jurisprudência aplicável.
	    9. **DOS HONORÁRIOS ADVOCATÍCIOS** O reclamante postula a condenação da reclamada ao pagamento de honorários de sucumbência em percentual de 15% (quinze por cento) sobre o valor total bruto da condenação, previstos no art. 791-A, caput, CLT, artigo 85, § 2º, do CPC/2015 e no artigo 22 do Estatuto da OAB (Lei nº 8.906/94).
DA LIQUIDAÇÃO DA EXORDIAL NOS TERMOS DA Nº LEI 13.467/17
	 Salienta que a referida Lei nº 13.467/17 estabeleceu que as reclamatórias trabalhistas devem conter os valores de seus pedidos. 
Diante disto, o reclamante salienta que esta apresentação de cálculos na fase inicial, segue com fulcro no art. 324 CPC, descrito abaixo:
Art. 324.CPC
O pedido deve ser determinado.
§ 1º É lícito, porém, formular pedido genérico:
I - nas ações universais, se o autor não puder individuar os bens demandados;
II - quando não for possível determinar, desde logo, as consequências do ato ou do fato;
III - quando a determinação do objeto ou do valor da condenação depender de ato que deva ser praticado pelo réu.
§ 2º O disposto neste artigo aplica-se à reconvenção.
Considerando que foi afastada a necessidade de valor líquido para os pedidos em ação trabalhista, sendo que a 1ª Seção de Dissídios Individuais do TRT-4 (RS) que concedeu por unanimidade, mandado de segurança que aborda a questão da obrigatoriedade, ou não, de as petições iniciais formularem pedidos líquidos com valores certos. O julgado concluiu ser desnecessária a indicação de um valor líquido para os pedidos, bastando a apresentação de um valor determinado. (Proc. nº 0020054-24.2018.5.04.0000). Vejamos os trechos do julgamento:
No julgamento - cujo relator foi o desembargador João Paulo Lucena, - foi reafirmado "o princípio constitucional que garante a todo cidadão brasileiro o amplo acesso à justiça, sem a necessidade de formalidade, sobretudo na preservação dos direitos nas relações de emprego".
"Conforme o art. 840, § 1º, da CLT, o pedido dever ser certo, determinado e indicar o seu valor, o que, contudo, não significa que o pedido deva ser líquido. 
Não é exigível da parte a apresentação de pedido líquido e certo estritamente interpretado e a traduzir com exatidão o quantum debeatur do direito reclamado, como se liquidação antecipada da execução fosse, antes mesmo de constituída a relação processual. A "Indicação do seu valor" (do pedido), o que deve ser tomado, literalmente, como uma indicação e não como uma certeza, a qual somente se obterá com os limites fixados no julgamento e após a necessária liquidação. Conforme lembra JORGE SOUTO MAIOR, assim agiu o próprio legislador da Reforma Trabalhista ao deixar claro que a definição do valor efetivamente devido será feita com a liquidação da sentença, conforme o teor do art. 791-A, o qual estabelece que os honorários advocatícios devidos ao advogado do reclamante serão calculados sobre "o valor que resultar da liquidação da sentença".
Neste sentido, o ato processual diz respeito ao atendimento dos requisitos legais previstos para a petição inicial, que deveriam ser aqueles dispostos na CLT já com as alterações feitas pela Lei nº 13.467/17 e que apenas determina sejam apontados os valores na peça inaugural, não exigindo sua liquidação exata neste aspecto.
Portanto, assim deve ser recebida a presente exordial, considerando que fora preenchido os requisitos legais.

	    10. **CÁLCULO ESTIMADO DOS VALORES DA CAUSA:** Detalhe, item por item, os valores estimados para cada verba pleiteada e, ao final, apresente a soma total.
        11. **DOS PEDIDOS:** Liste de forma clara e objetiva todas as solicitações (pedidos certos, determinados e com indicação de seu valor, não esqueça de mencionar: “Juízo 100% Digital”, "benefício da Justiça Gratuita" e "DA MULTA DO ART. 477 DA CLT" ).
        12.  **DOS REQUERIMENTOS FINAIS:** Inclua os requerimentos de praxe (citação, provas, justiça gratuita, honorários, etc.).
        13.  **VALOR DA CAUSA.**
        14.  **FECHAMENTO:** "Nestes termos, pede deferimento. [Local (deve ser o mesmo  da VARA DO TRABALHO DE) ], [data atual que esta sendo gerado esta petição]. ANDERSON FURTADO PEREIRA OAB/RS 52.035; DIRCEU ROCHA JUNIOR OAB/RS 55.401; LUCIANO MATHEUS KISSMANN OAB/RS 101.353; PAULO RODRIGO CASTELI ROSSETO OAB/DF 27.839 ".
  `;
    }
      
    const formattingInstruction = `
        \nINSTRUÇÃO DE FORMATAÇÃO FINAL (PRIORIDADE MÁXIMA):
        Gere o conteúdo final em formato de documento jurídico profissional, seguindo rigorosamente as seguintes configurações de estilo e formatação:

        📄 Configurações do Documento
        - Papel: A4 (21 x 29,7 cm)
        - Margens: Superior 2,5 cm | Inferior 2,5 cm | Esquerda 3,0 cm | Direita 2,0 cm
        - Fonte principal: Bookman Old Style
        - Tamanho da fonte:
          - Corpo do texto: Bookman Old Style, Recuo: Primeira linha:  3 cm, Justificado Espaçamento entre linhas:  1,5 linhas, Espaço Antes:  14 pt  Depois de:  14 pt
          - Títulos e subtítulos: Bookman Old Style, 12 pt, Negrito, Todas em Maiúsculas, Dimensão de caractere: 105%, Centralizado, Espaçamento entre linhas:  1,5 linhas, Espaço  Antes:  28 pt  Depois de:  18 pt
        - Alinhamento: Justificado
        - Recuo de primeira linha: 1,25 cm
        - Espaçamento entre linhas: 1,5 linha
        - Espaçamento entre parágrafos: Antes: 0 pt / Depois: 0 pt
        - Cabeçalho e rodapé: 1,25 cm.

        Gere o texto formatado com todas as regras acima, estruturado como se fosse um documento Word pronto para impressão.
        REGRA CRÍTICA DE FORMATAÇÃO: É terminantemente proibido o uso de formatação markdown. NUNCA, em nenhuma circunstância, utilize asteriscos duplos (\`**\`) para aplicar negrito ou qualquer outra ênfase. A única forma de destaque para títulos é o uso de LETRAS MAIÚSCULAS, conforme definido nas regras de formatação. O texto final não deve conter nenhum caractere \`*\`.
        O idioma deve ser português do Brasil, com linguagem técnica, formal e persuasiva.
        A petição deve ser gerada como um texto único e coeso.
    `;
    prompt += formattingInstruction;

    const finalPrompt = extractedTexts + prompt;

    try {
        const fileParts = await Promise.all(nativeFiles.map(file => fileToGenerativePart(file)));
        const allPartsInRequest = [{ text: finalPrompt }, ...fileParts];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{ parts: allPartsInRequest }],
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
            },
        });

        if (response.candidates?.[0]?.finishReason && response.candidates?.[0]?.finishReason !== 'STOP') {
            throw new Error(`A geração foi bloqueada. Motivo: ${response.candidates[0].finishReason}.`);
        }
        return response.text;

    } catch (e: any) {
        console.error("Erro ao gerar petição inicial:", e);
        if (e.message && (e.message.includes('Unsupported MIME type') || e.message.includes('400'))) {
             throw new Error(`O tipo de arquivo de um dos documentos não é suportado. Por favor, tente converter para PDF ou TXT. Detalhes: ${e.message}`);
        }
        throw new Error(`Ocorreu um erro ao processar os documentos. Detalhes: ${e.message}`);
    }
};