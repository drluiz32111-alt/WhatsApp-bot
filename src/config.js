export const config = {
  prefix: "!",
  ownerNumber: "5511999999999",
  currency: "🪙",
  startingCoins: 100,
  dailyReward: 250,
  workRewardMin: 50,
  workRewardMax: 150,
  xpPerMessage: 2,
  xpCooldownMs: 30000
};

export const roles = [
  { name: "Novato", minXp: 0 },
  { name: "Membro", minXp: 100 },
  { name: "Veterano", minXp: 300 },
  { name: "Elite", minXp: 700 },
  { name: "Lenda", minXp: 1500 }
];
