const { getDb, rowToCard } = require('../config/database');
const { connectFirebird }  = require('../config/firebird');
const { broadcast }        = require('./sseClients');

async function pollNF() {
  const db      = getDb();
  const pending = db.prepare(
    'SELECT id, cd_saida FROM kanban_cards WHERE cd_saida IS NOT NULL AND nf_emitida = 0 AND concluido = 0'
  ).all();

  if (pending.length === 0) return;

  let fbDb;
  try {
    fbDb = await connectFirebird();
    const ids          = pending.map(c => c.cd_saida);
    const placeholders = ids.map(() => '?').join(',');

    await new Promise(resolve => {
      fbDb.query(
        `SELECT CD_SAIDA, DT_TRANSMISSAO, DS_NUMERO_NOTA FROM SAIDAS
         WHERE CD_SAIDA IN (${placeholders}) AND DT_TRANSMISSAO IS NOT NULL`,
        ids,
        (err, rows) => {
          fbDb.detach();
          if (err || !rows || rows.length === 0) return resolve();

          for (const row of rows) {
            const card = pending.find(c => c.cd_saida === row.CD_SAIDA);
            if (!card) continue;

            const nfNumero = row.DS_NUMERO_NOTA ? String(row.DS_NUMERO_NOTA).trim() : '';

            db.prepare('UPDATE kanban_cards SET nf_emitida = 1, nf_numero = ? WHERE id = ?')
              .run(nfNumero, card.id);

            // Atualiza WEB_CHECKLIST_OS_LINK no Firebird (fire-and-forget)
            atualizarNfFirebird(row.CD_SAIDA, nfNumero, row.DT_TRANSMISSAO);

            const updated = rowToCard(db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(card.id));
            broadcast('card_updated', updated);
            console.log(`[Poller] NF ${nfNumero} detectada — card ${card.id} atualizado.`);
          }

          resolve();
        }
      );
    });
  } catch {
    if (fbDb) try { fbDb.detach(); } catch {}
  }
}

async function atualizarNfFirebird(cdSaida, nfNumero, dtTransmissao) {
  let fbDb;
  try {
    fbDb = await connectFirebird();
    await new Promise((resolve, reject) => {
      fbDb.query(
        `UPDATE WEB_CHECKLIST_OS_LINK
         SET CK_NF_EMITIDA = 'T', DS_NUMERO_NF = ?, DT_NF_EMITIDA = ?
         WHERE CD_SAIDA = ? AND CK_NF_EMITIDA = 'F'`,
        [nfNumero, dtTransmissao || new Date(), cdSaida],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });
    fbDb.detach();
  } catch {
    if (fbDb) try { fbDb.detach(); } catch {}
  }
}

function startPoller(intervalMs = 30000) {
  setInterval(pollNF, intervalMs);
  console.log(`[Poller] NF poller iniciado — verificando a cada ${intervalMs / 1000}s`);
}

module.exports = { startPoller };
