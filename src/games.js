const quiz = [
  {
    question: "Qual é a capital do Brasil?",
    answers: ["brasilia", "brasília"]
  },
  {
    question: "Quanto é 7 × 8?",
    answers: ["56"]
  },
  {
    question: "Qual planeta é conhecido como planeta vermelho?",
    answers: ["marte"]
  },
  {
    question: "Quantos lados tem um hexágono?",
    answers: ["6", "seis"]
  },
  {
    question: "Qual é o maior planeta do Sistema Solar?",
    answers: ["jupiter", "júpiter"]
  }
];

export function dice() {
  return Math.floor(Math.random() * 6) + 1;
}

export function randomNumber() {
  return Math.floor(Math.random() * 10) + 1;
}

export function randomQuiz() {
  return quiz[Math.floor(Math.random() * quiz.length)];
}
