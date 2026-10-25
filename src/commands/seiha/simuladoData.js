/**
 * Banco de perguntas do /simulado.
 *
 * Perguntas fechadas, de escola, com uma única resposta correta e uma
 * explicação curta. Ficam em arquivo separado para dar para ampliar sem
 * mexer na lógica do jogo.
 *
 * `correta` é o índice (0-3) da opção certa em `opcoes`.
 */

export const BANCO_SIMULADO = [
  {
    materia: 'Matemática',
    pergunta: 'Quanto é 15% de 200?',
    opcoes: ['20', '25', '30', '35'],
    correta: 2,
    explicacao: '15% de 200 = 0,15 × 200 = 30.'
  },
  {
    materia: 'Matemática',
    pergunta: 'Qual é a raiz quadrada de 144?',
    opcoes: ['10', '11', '12', '14'],
    correta: 2,
    explicacao: '12 × 12 = 144.'
  },
  {
    materia: 'Matemática',
    pergunta: 'Um triângulo tem ângulos de 50° e 60°. Quanto mede o terceiro?',
    opcoes: ['60°', '70°', '80°', '90°'],
    correta: 1,
    explicacao: 'A soma dos ângulos internos é 180°: 180 − 50 − 60 = 70°.'
  },
  {
    materia: 'Matemática',
    pergunta: 'Quanto é 2 elevado a 5?',
    opcoes: ['16', '25', '32', '64'],
    correta: 2,
    explicacao: '2 × 2 × 2 × 2 × 2 = 32.'
  },
  {
    materia: 'Matemática',
    pergunta: 'Qual é a área de um quadrado de lado 7?',
    opcoes: ['14', '28', '42', '49'],
    correta: 3,
    explicacao: 'Área do quadrado = lado² = 7² = 49.'
  },
  {
    materia: 'Matemática',
    pergunta: 'Qual é o MMC de 4 e 6?',
    opcoes: ['8', '10', '12', '24'],
    correta: 2,
    explicacao: 'Os múltiplos comuns começam em 12: 12 é o menor.'
  },
  {
    materia: 'Matemática',
    pergunta: 'A fração 3/4 corresponde a qual porcentagem?',
    opcoes: ['25%', '50%', '75%', '80%'],
    correta: 2,
    explicacao: '3 ÷ 4 = 0,75 = 75%.'
  },
  {
    materia: 'Português',
    pergunta: 'Qual destas palavras é um substantivo?',
    opcoes: ['correr', 'cadeira', 'rapidamente', 'bonito'],
    correta: 1,
    explicacao: '"Cadeira" nomeia um objeto; as outras são verbo, advérbio e adjetivo.'
  },
  {
    materia: 'Português',
    pergunta: 'Qual é o plural de "cidadão"?',
    opcoes: ['cidadões', 'cidadãos', 'cidadães', 'cidadans'],
    correta: 1,
    explicacao: 'O plural correto é "cidadãos".'
  },
  {
    materia: 'Português',
    pergunta: 'A conjunção "mas" introduz ideia de:',
    opcoes: ['adição', 'oposição', 'conclusão', 'explicação'],
    correta: 1,
    explicacao: '"Mas" é uma conjunção adversativa: marca oposição.'
  },
  {
    materia: 'Português',
    pergunta: 'Qual frase está de acordo com a norma culta?',
    opcoes: ['A muitos livros na estante.', 'Há muitos livros na estante.', 'Haviam muitos livros na estante.', 'Fazem muitos livros na estante.'],
    correta: 1,
    explicacao: '"Haver" no sentido de existir é impessoal: fica sempre no singular.'
  },
  {
    materia: 'Português',
    pergunta: 'Qual é o antônimo de "efêmero"?',
    opcoes: ['passageiro', 'duradouro', 'rápido', 'raro'],
    correta: 1,
    explicacao: 'Efêmero é o que dura pouco; o contrário é duradouro.'
  },
  {
    materia: 'Português',
    pergunta: 'Em "Os alunos estudaram", qual é o sujeito?',
    opcoes: ['estudaram', 'os alunos', 'alunos estudaram', 'não há sujeito'],
    correta: 1,
    explicacao: 'O sujeito é "os alunos"; "estudaram" é o predicado.'
  },
  {
    materia: 'História',
    pergunta: 'Em que ano começou a Segunda Guerra Mundial?',
    opcoes: ['1914', '1939', '1945', '1950'],
    correta: 1,
    explicacao: 'A invasão da Polônia pela Alemanha, em 1939, deu início ao conflito.'
  },
  {
    materia: 'História',
    pergunta: 'Quem foi o primeiro imperador do Brasil?',
    opcoes: ['Dom João VI', 'Dom Pedro I', 'Dom Pedro II', 'Marechal Deodoro'],
    correta: 1,
    explicacao: 'Dom Pedro I proclamou a Independência em 1822 e foi o primeiro imperador.'
  },
  {
    materia: 'História',
    pergunta: 'Qual civilização construiu as pirâmides de Gizé?',
    opcoes: ['grega', 'romana', 'egípcia', 'persa'],
    correta: 2,
    explicacao: 'As pirâmides de Gizé foram construídas no Egito Antigo.'
  },
  {
    materia: 'História',
    pergunta: 'Em que ano a Lei Áurea foi assinada?',
    opcoes: ['1822', '1850', '1888', '1891'],
    correta: 2,
    explicacao: 'A Lei Áurea foi assinada em 13 de maio de 1888.'
  },
  {
    materia: 'História',
    pergunta: 'Em que ano foi proclamada a República no Brasil?',
    opcoes: ['1822', '1888', '1889', '1930'],
    correta: 2,
    explicacao: 'A Proclamação da República aconteceu em 15 de novembro de 1889.'
  },
  {
    materia: 'Geografia',
    pergunta: 'Qual é o maior estado brasileiro em área?',
    opcoes: ['Pará', 'Amazonas', 'Mato Grosso', 'Bahia'],
    correta: 1,
    explicacao: 'O Amazonas é o maior estado do Brasil em território.'
  },
  {
    materia: 'Geografia',
    pergunta: 'Qual rio nasce em Salesópolis e atravessa o estado de São Paulo?',
    opcoes: ['Pinheiros', 'Tietê', 'Tamanduateí', 'Paraíba do Sul'],
    correta: 1,
    explicacao: 'O Tietê nasce em Salesópolis e corta o interior paulista.'
  },
  {
    materia: 'Geografia',
    pergunta: 'Qual é o planeta mais próximo do Sol?',
    opcoes: ['Vênus', 'Terra', 'Mercúrio', 'Marte'],
    correta: 2,
    explicacao: 'Mercúrio é o primeiro planeta a partir do Sol.'
  },
  {
    materia: 'Geografia',
    pergunta: 'Qual oceano banha o litoral brasileiro?',
    opcoes: ['Pacífico', 'Índico', 'Atlântico', 'Ártico'],
    correta: 2,
    explicacao: 'Todo o litoral do Brasil é banhado pelo Oceano Atlântico.'
  },
  {
    materia: 'Geografia',
    pergunta: 'Qual é a capital do Brasil?',
    opcoes: ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'],
    correta: 2,
    explicacao: 'Brasília é a capital federal desde 1960.'
  },
  {
    materia: 'Ciências',
    pergunta: 'Qual organela é conhecida como a "usina de energia" da célula?',
    opcoes: ['ribossomo', 'mitocôndria', 'lisossomo', 'núcleo'],
    correta: 1,
    explicacao: 'A mitocôndria produz ATP, a energia usada pela célula.'
  },
  {
    materia: 'Ciências',
    pergunta: 'Qual gás as plantas absorvem na fotossíntese?',
    opcoes: ['oxigênio', 'nitrogênio', 'gás carbônico', 'hidrogênio'],
    correta: 2,
    explicacao: 'As plantas absorvem gás carbônico (CO₂) e liberam oxigênio.'
  },
  {
    materia: 'Ciências',
    pergunta: 'Qual é o maior órgão do corpo humano?',
    opcoes: ['fígado', 'pele', 'pulmão', 'intestino'],
    correta: 1,
    explicacao: 'A pele é o maior órgão do corpo humano.'
  },
  {
    materia: 'Ciências',
    pergunta: 'Quantos ossos tem o corpo humano adulto?',
    opcoes: ['186', '196', '206', '216'],
    correta: 2,
    explicacao: 'O esqueleto adulto tem 206 ossos.'
  },
  {
    materia: 'Ciências',
    pergunta: 'Qual é a unidade de força no Sistema Internacional?',
    opcoes: ['joule', 'watt', 'newton', 'pascal'],
    correta: 2,
    explicacao: 'A força é medida em newton (N).'
  },
  {
    materia: 'Inglês',
    pergunta: 'Como se diz "livro" em inglês?',
    opcoes: ['book', 'table', 'house', 'door'],
    correta: 0,
    explicacao: '"Book" significa livro.'
  },
  {
    materia: 'Inglês',
    pergunta: 'Qual é o passado do verbo "go"?',
    opcoes: ['goed', 'gone', 'went', 'going'],
    correta: 2,
    explicacao: '"Go" é irregular: o passado é "went".'
  }
];
