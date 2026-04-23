const clients = new Set();

function addClient(res)    { clients.add(res); }
function removeClient(res) { clients.delete(res); }

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(c => { try { c.write(msg); } catch { clients.delete(c); } });
}

module.exports = { addClient, removeClient, broadcast };
