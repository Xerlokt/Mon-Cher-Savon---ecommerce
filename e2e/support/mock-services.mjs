// Local stand-ins for the external services, so end-to-end tests never call a real API.
//  - Mercado Pago:  POST /v1/payments, GET /v1/payments/:id
//  - Telegram:      POST /bot<token>/sendMessage
//  - Test control:  POST /__control/approve/:id, GET /__control/telegram, POST /__control/reset
import http from 'node:http';

const port = Number(process.env.MOCK_PORT ?? 4020);
let nextId = 1000;
const payments = new Map();
const telegram = [];

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === 'POST' && path === '/v1/payments') {
    const body = await readBody(req);
    const id = String(++nextId);
    payments.set(id, { status: 'pending', external_reference: body.external_reference });
    return json(res, 201, {
      id: Number(id),
      status: 'pending',
      point_of_interaction: {
        transaction_data: {
          qr_code: `00020126E2E${id}BR.GOV.BCB.PIX`,
          // 1x1 transparent PNG
          qr_code_base64:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        },
      },
    });
  }

  const payment = path.match(/^\/v1\/payments\/(\d+)$/);
  if (req.method === 'GET' && payment) {
    const found = payments.get(payment[1]);
    if (!found) return json(res, 404, { message: 'not found' });
    return json(res, 200, { id: Number(payment[1]), ...found });
  }

  if (req.method === 'POST' && /^\/bot[^/]+\/sendMessage$/.test(path)) {
    const body = await readBody(req);
    telegram.push({ chat_id: body.chat_id, text: body.text });
    return json(res, 200, { ok: true });
  }

  const approve = path.match(/^\/__control\/approve\/(\d+)$/);
  if (req.method === 'POST' && approve) {
    const found = payments.get(approve[1]);
    if (!found) return json(res, 404, { message: 'unknown payment' });
    found.status = 'approved';
    return json(res, 200, { approved: approve[1] });
  }
  if (req.method === 'GET' && path === '/__control/telegram') return json(res, 200, telegram);
  if (req.method === 'GET' && path === '/__control/payments') {
    return json(res, 200, Object.fromEntries(payments));
  }
  if (req.method === 'POST' && path === '/__control/reset') {
    payments.clear();
    telegram.length = 0;
    return json(res, 200, { reset: true });
  }
  if (req.method === 'GET' && path === '/__health') return json(res, 200, { ok: true });

  return json(res, 404, { message: `no mock for ${req.method} ${path}` });
});

server.listen(port, '127.0.0.1', () => console.log(`mock services listening on ${port}`));
