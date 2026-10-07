import fs from "node:fs";
import path from "node:path";
import { config, roles } from "./config.js";

const FILE = path.resolve("data.json");

let db = { users: {} };

if (fs.existsSync(FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    console.log("Banco inválido. Criando novo banco.");
  }
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export function getUser(id, name = "Usuário") {
  if (!db.users[id]) {
    db.users[id] = {
      id,
      name,
      coins: config.startingCoins,
      xp: 0,
      dailyAt: 0,
      workAt: 0,
      customRole: null,
      createdAt: Date.now()
    };
    save();
  } else {
    if (name) db.users[id].name = name;
  }

  return db.users[id];
}

export function addCoins(id, amount, name = "Usuário") {
  const user = getUser(id, name);
  user.coins += amount;

  if (user.coins < 0) user.coins = 0;

  save();
  return user;
}

export function addXp(id, amount, name = "Usuário") {
  const user = getUser(id, name);
  user.xp += amount;

  if (user.xp < 0) user.xp = 0;

  save();
  return user;
}

export function setRole(id, role, name = "Usuário") {
  const user = getUser(id, name);
  user.customRole = role;

  save();
  return user;
}

export function topCoins(limit = 10) {
  return Object.values(db.users)
    .sort((a, b) => b.coins - a.coins)
    .slice(0, limit);
}

export function topXp(limit = 10) {
  return Object.values(db.users)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

export function getRole(user) {
  if (user.customRole) return user.customRole;

  let current = roles[0].name;

  for (const role of roles) {
    if (user.xp >= role.minXp) {
      current = role.name;
    }
  }

  return current;
}

export function resetAll() {
  db.users = {};
  save();
}
