import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import { Boom } from "@hapi/boom";

import pino from "pino";

import qrcode from "qrcode-terminal";

import {
  getUser,
  addCoins,
  addXp,
  setRole,
  topCoins,
  topXp,
  getRole,
  resetAll
} from "./database.js";

import {
  config
} from "./config.js";

import {
  dice,
  randomNumber,
  randomQuiz
} from "./games.js";


const xpCooldown = new Map();

const pendingQuiz = new Map();


function normalizeJid(jid) {

  if (!jid) return null;

  return jid.split(":")[0];

}


function getName(msg) {

  return msg.pushName || "Usuário";

}


function isOwner(jid) {

  return normalizeJid(jid) ===
    `${config.ownerNumber}@s.whatsapp.net`;

}


function formatNumber(number) {

  return Number(number)
    .toLocaleString("pt-BR");

}


function getMentioned(msg) {

  return (
    msg.message
      ?.extendedTextMessage
      ?.contextInfo
      ?.mentionedJid?.[0]
  );

}


function help() {

  return `
🤖 *BOT WHATSAPP*

━━━━━━━━━━━━━━

💰 *ECONOMIA*

!saldo
!daily
!trabalhar
!pagar @pessoa 100
!ranking

━━━━━━━━━━━━━━

⭐ *XP / HIERARQUIA*

!perfil
!rankxp

━━━━━━━━━━━━━━

🎮 *JOGOS*

!dado
!numero 1-10
!quiz

━━━━━━━━━━━━━━

🛡️ *ADMIN*

!addmoedas @pessoa 100
!removermoedas @pessoa 100
!setcargo @pessoa Moderador
!reset

━━━━━━━━━━━━━━

Use !menu para abrir novamente.
`;

}


async function startBot() {

  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(
    "auth_info_baileys"
  );


  const {
    version
  } = await fetchLatestBaileysVersion();


  const sock = makeWASocket({

    version,

    auth: state,

    logger: pino({
      level: "silent"
    }),

    markOnlineOnConnect: false

  });


  sock.ev.on(
    "creds.update",
    saveCreds
  );


  sock.ev.on(
    "connection.update",
    ({ connection, lastDisconnect, qr }) => {

      if (qr) {

        console.log(
          "\n📱 Escaneie este QR Code no WhatsApp:\n"
        );

        qrcode.generate(
          qr,
          {
            small: true
          }
        );

      }


      if (connection === "open") {

        console.log(
          "✅ BOT CONECTADO!"
        );

      }


      if (connection === "close") {

        const code =
          new Boom(
            lastDisconnect?.error
          )?.output?.statusCode;


        if (
          code !==
          DisconnectReason.loggedOut
        ) {

          console.log(
            "🔄 Reconectando..."
          );

          startBot();

        } else {

          console.log(
            "❌ Sessão encerrada."
          );

        }

      }

    }
  );


  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {

      const msg = messages[0];


      if (
        !msg?.message ||
        msg.key.fromMe
      ) {
        return;
      }


      const jid =
        msg.key.remoteJid;


      if (
        !jid ||
        jid === "status@broadcast"
      ) {
        return;
      }


      const text =
        msg.message.conversation ||
        msg.message
          ?.extendedTextMessage
          ?.text ||
        "";


      const clean =
        text.trim();


      const sender =
        normalizeJid(
          msg.key.participant ||
          jid
        );


      const name =
        getName(msg);


      const user =
        getUser(
          sender,
          name
        );


      /*
       * XP AUTOMÁTICO
       */

      const now = Date.now();

      const last =
        xpCooldown.get(sender) || 0;


      if (
        now - last >=
        config.xpCooldownMs
      ) {

        addXp(
          sender,
          config.xpPerMessage,
          name
        );

        xpCooldown.set(
          sender,
          now
        );

      }


      /*
       * RESPOSTA DO QUIZ
       */

      if (
        pendingQuiz.has(jid) &&
        !clean.startsWith(
          config.prefix
        )
      ) {

        const quiz =
          pendingQuiz.get(jid);


        const answer =
          clean.toLowerCase();


        if (
          quiz.answers
            .includes(answer)
        ) {

          addCoins(
            sender,
            100,
            name
          );


          addXp(
            sender,
            25,
            name
          );


          pendingQuiz.delete(jid);


          await sock.sendMessage(
            jid,
            {
              text:
                `🎉 *ACERTOU!*\n\n` +
                `🪙 +100 moedas\n` +
                `⭐ +25 XP`
            }
          );

        }

        return;

      }


      if (
        !clean.startsWith(
          config.prefix
        )
      ) {
        return;
      }


      const parts =
        clean
          .slice(config.prefix.length)
          .trim()
          .split(/\s+/);


      const command =
        (parts.shift() || "")
          .toLowerCase();


      const args = parts;


      try {

        /*
         * MENU
         */

        if (
          command === "menu" ||
          command === "help" ||
          command === "ajuda"
        ) {

          await sock.sendMessage(
            jid,
            {
              text: help()
            }
          );

          return;

        }


        /*
         * SALDO
         */

        if (
          command === "saldo"
        ) {

          const u =
            getUser(
              sender,
              name
            );


          await sock.sendMessage(
            jid,
            {
              text:
                `💰 *SEU SALDO*\n\n` +
                `👤 ${u.name}\n` +
                `🪙 ${formatNumber(u.coins)} moedas\n` +
                `⭐ ${formatNumber(u.xp)} XP\n` +
                `🏷️ ${getRole(u)}`
            }
          );

          return;

        }


        /*
         * PERFIL
         */

        if (
          command === "perfil"
        ) {

          const u =
            getUser(
              sender,
              name
            );


          await sock.sendMessage(
            jid,
            {
              text:
                `👤 *PERFIL*\n\n` +
                `Nome: ${u.name}\n\n` +
                `🪙 Moedas: ${formatNumber(u.coins)}\n` +
                `⭐ XP: ${formatNumber(u.xp)}\n` +
                `🏷️ Cargo: ${getRole(u)}`
            }
          );

          return;

        }


        /*
         * DAILY
         */

        if (
          command === "daily"
        ) {

          const u =
            getUser(
              sender,
              name
            );


          const cooldown =
            24 * 60 * 60 * 1000;


          const remaining =
            cooldown -
            (
              Date.now() -
              u.dailyAt
            );


          if (
            remaining > 0
          ) {

            const hours =
              Math.ceil(
                remaining /
                3600000
              );


            await sock.sendMessage(
              jid,
              {
                text:
                  `⏳ Você já pegou sua recompensa.\n` +
                  `Volte em aproximadamente ${hours}h.`
              }
            );

            return;

          }


          addCoins(
            sender,
            config.dailyReward,
            name
          );


          u.dailyAt =
            Date.now();


          await sock.sendMessage(
            jid,
            {
              text:
                `🎁 *RECOMPENSA DIÁRIA*\n\n` +
                `🪙 +${config.dailyReward} moedas!`
            }
          );

          return;

        }


        /*
         * TRABALHAR
         */

        if (
          command === "trabalhar"
        ) {

          const u =
            getUser(
              sender,
              name
            );


          const cooldown =
            60 * 60 * 1000;


          const remaining =
            cooldown -
            (
              Date.now() -
              u.workAt
            );


          if (
            remaining > 0
          ) {

            const minutes =
              Math.ceil(
                remaining /
                60000
              );


            await sock.sendMessage(
              jid,
              {
                text:
                  `⏳ Você precisa esperar ${minutes} minutos.`
              }
            );

            return;

          }


          const reward =
            Math.floor(
              Math.random() *
              (
                config.workRewardMax -
                config.workRewardMin +
                1
              )
            ) +
            config.workRewardMin;


          addCoins(
            sender,
            reward,
            name
          );


          u.workAt =
            Date.now();


          await sock.sendMessage(
            jid,
            {
              text:
                `💼 *TRABALHO CONCLUÍDO!*\n\n` +
                `🪙 Você ganhou ${reward} moedas.`
            }
          );

          return;

        }


        /*
         * RANKING DE MOEDAS
         */

        if (
          command === "ranking"
        ) {

          const list =
            topCoins(10);


          if (
            list.length === 0
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "Ainda não existem jogadores."
              }
            );

            return;

          }


          const ranking =
            list
              .map(
                (u, index) =>
                  `${index + 1}. ${u.name} — 🪙 ${formatNumber(u.coins)}`
              )
              .join("\n");


          await sock.sendMessage(
            jid,
            {
              text:
                `🏆 *RANKING DE MOEDAS*\n\n${ranking}`
            }
          );

          return;

        }


        /*
         * RANKING XP
         */

        if (
          command === "rankxp"
        ) {

          const list =
            topXp(10);


          const ranking =
            list
              .map(
                (u, index) =>
                  `${index + 1}. ${u.name} — ⭐ ${formatNumber(u.xp)} XP — ${getRole(u)}`
              )
              .join("\n");


          await sock.sendMessage(
            jid,
            {
              text:
                `⭐ *RANKING DE XP*\n\n${ranking}`
            }
          );

          return;

        }


        /*
         * PAGAR
         */

        if (
          command === "pagar"
        ) {

          const target =
            getMentioned(msg);


          const amount =
            Number(
              args.find(
                x =>
                  /^\d+$/.test(x)
              )
            );


          if (
            !target ||
            !Number.isInteger(amount) ||
            amount <= 0
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "Use: !pagar @pessoa 100"
              }
            );

            return;

          }


          const from =
            getUser(
              sender,
              name
            );


          if (
            from.coins < amount
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "❌ Você não possui moedas suficientes."
              }
            );

            return;

          }


          addCoins(
            sender,
            -amount,
            name
          );


          addCoins(
            normalizeJid(target),
            amount
          );


          await sock.sendMessage(
            jid,
            {
              text:
                `✅ Você transferiu 🪙 ${formatNumber(amount)}.`
            }
          );

          return;

        }


        /*
         * DADO
         */

        if (
          command === "dado"
        ) {

          const result =
            dice();


          addXp(
            sender,
            5,
            name
          );


          await sock.sendMessage(
            jid,
            {
              text:
                `🎲 Você tirou *${result}*!\n⭐ +5 XP`
            }
          );

          return;

        }


        /*
         * NÚMERO
         */

        if (
          command === "numero"
        ) {

          const guess =
            Number(args[0]);


          if (
            !Number.isInteger(guess) ||
            guess < 1 ||
            guess > 10
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "Use: !numero 1 até 10"
              }
            );

            return;

          }


          const answer =
            randomNumber();


          if (
            guess === answer
          ) {

            addCoins(
              sender,
              50,
              name
            );


            addXp(
              sender,
              15,
              name
            );


            await sock.sendMessage(
              jid,
              {
                text:
                  `🎯 *ACERTOU!*\n\n` +
                  `O número era ${answer}.\n\n` +
                  `🪙 +50 moedas\n` +
                  `⭐ +15 XP`
              }
            );

          } else {

            await sock.sendMessage(
              jid,
              {
                text:
                  `❌ Não foi dessa vez.\nO número era ${answer}.`
              }
            );

          }

          return;

        }


        /*
         * QUIZ
         */

        if (
          command === "quiz"
        ) {

          const question =
            randomQuiz();


          pendingQuiz.set(
            jid,
            question
          );


          await sock.sendMessage(
            jid,
            {
              text:
                `🧠 *QUIZ*\n\n` +
                `${question.question}\n\n` +
                `Responda com a resposta!`
            }
          );

          return;

        }


        /*
         * COMANDOS DE ADMIN
         */

        if (
          command === "addmoedas" ||
          command === "removermoedas"
        ) {

          if (
            !isOwner(sender)
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "❌ Apenas o dono pode usar esse comando."
              }
            );

            return;

          }


          const target =
            getMentioned(msg);


          const amount =
            Number(
              args.find(
                x =>
                  /^\d+$/.test(x)
              )
            );


          if (
            !target ||
            !Number.isInteger(amount) ||
            amount <= 0
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  `Use: !${command} @pessoa 100`
              }
            );

            return;

          }


          const value =
            command === "addmoedas"
              ? amount
              : -amount;


          addCoins(
            normalizeJid(target),
            value
          );


          await sock.sendMessage(
            jid,
            {
              text:
                `✅ Operação realizada: 🪙 ${formatNumber(amount)}.`
            }
          );

          return;

        }


        /*
         * SET CARGO
         */

        if (
          command === "setcargo"
        ) {

          if (
            !isOwner(sender)
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "❌ Apenas o dono pode usar esse comando."
              }
            );

            return;

          }


          const target =
            getMentioned(msg);


          const role =
            args
              .filter(
                x =>
                  !/^\d+$/.test(x)
              )
              .join(" ");


          if (
            !target ||
            !role
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "Use: !setcargo @pessoa Moderador"
              }
            );

            return;

          }


          setRole(
            normalizeJid(target),
            role
          );


          await sock.sendMessage(
            jid,
            {
              text:
                `🏷️ Cargo definido: *${role}*`
            }
          );

          return;

        }


        /*
         * RESET
         */

        if (
          command === "reset"
        ) {

          if (
            !isOwner(sender)
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "❌ Apenas o dono pode usar esse comando."
              }
            );

            return;

          }


          resetAll();


          await sock.sendMessage(
            jid,
            {
              text:
                "🧹 Banco de dados resetado."
            }
          );

          return;

        }


        /*
         * COMANDO DESCONHECIDO
         */

        await sock.sendMessage(
          jid,
          {
            text:
              "❓ Comando não encontrado.\nUse !menu"
          }
        );


      } catch (error) {

        console.error(
          "Erro:",
          error
        );


        await sock.sendMessage(
          jid,
          {
            text:
              "⚠️ Ocorreu um erro ao executar o comando."
          }
        );

      }

    }

  );

}


startBot();
