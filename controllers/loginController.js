const axios = require("axios");
const dotenv = require("dotenv");
const sql = require("mssql");
const dbConfigDw = require("../config/dbConfigDw");

dotenv.config();

const protheusAuthUrl = process.env.PROTHEUS_AUTH_URL || "https://consultas.cini.com.br:3032";

let _sharedPool = null;
async function getPool() {
  if (_sharedPool && _sharedPool.connected) return _sharedPool;
  const pool = new sql.ConnectionPool(dbConfigDw);
  _sharedPool = await pool.connect();
  _sharedPool.on('error', () => { _sharedPool = null; });
  return _sharedPool;
}

const WPP_DEST = '554188529918';
async function sendLoginFailWhatsApp(username, password, protheusServer, errMsg) {
  try {
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const msg =
      `⛔ Login com credenciais inválidas — Central de Tarefas\n` +
      `📅 ${now}\n${'━'.repeat(25)}\n\n` +
      `👤 Usuário: ${username}\n` +
      `🖥️ Servidor: ${protheusServer}\n⚠️ Erro: ${errMsg}`;
    const pool = await getPool();
    await pool.request()
      .input('dest', sql.NVarChar(50), WPP_DEST)
      .input('msg',  sql.NVarChar(4000), msg)
      .query(`INSERT INTO [dbo].[FATO_FILA_NOTIFICACOES]
                (TIPO_MENSAGEM, DESTINATARIO, MENSAGEM, STATUS, TENTATIVAS, DTINC)
              VALUES ('texto', @dest, @msg, 'PENDENTE', 0, GETDATE())`);
  } catch (e) {
    console.error('[wpp] Falha ao notificar login inválido:', e.message);
  }
}

async function validaLogin(username, password, res, req) {
  try {
    if (req && req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Erro ao limpar sessão anterior:", err);
        }
      });
    }

    res.clearCookie("token", { httpOnly: true, secure: false, sameSite: "lax" });
    res.clearCookie("refresh_token", { httpOnly: true, secure: false, sameSite: "lax" });
    res.clearCookie("username", { httpOnly: true, secure: false, sameSite: "lax" });

    const response = await axios.post(
      `${protheusAuthUrl}/rest/api/oauth2/v1/token`,
      null,
      {
        params: { grant_type: "password", username: username, password: password },
        headers: { "X-Client-IP": req?.ip },
        timeout: 10000,
      }
    );

    let { access_token, refresh_token } = response.data || {};
    res.cookie("token", access_token, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 3600000 });
    res.cookie("refresh_token", refresh_token, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 43200000 });
    res.cookie("username", username, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 43200000 });

    if (!res.headersSent) {
      return res.status(200).json({ message: "Login bem-sucedido!", redirect: '/dashboard' });
    }
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message || 'desconhecido';
    console.error("Erro ao realizar login:", {
      message: error.message,
      responseData: error.response ? error.response.data : null,
      responseStatus: error.response ? error.response.status : null,
      requestData: { username, protheusAuthUrl },
    });
    sendLoginFailWhatsApp(username, password, protheusAuthUrl, errMsg).catch(() => {});
    if (error.response?.data?.passwordLocked) {
      return res.redirect(`/loginPage?error=password_locked&username=${encodeURIComponent(username)}`);
    }
    return res.redirect("/loginPage?error=invalid_credentials");
  }
}

async function verificarEAtualizarToken(req, res, next) {
  if (req.session && req.session.userID && req.session.groups && req.session.groups.length > 0) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    if (now - lastActivity < 120 * 60 * 1000) {
      req.session.lastActivity = now;
      return next();
    }
  }
  const token = req.cookies["token"];
  const refresh_token = req.cookies["refresh_token"];
  if (!token && refresh_token) {
    const atualizou = await atualizaToken(refresh_token, res);
    if (!atualizou) return res.redirect("/loginPage");
    return next();
  } else if (!token && !refresh_token) {
    return res.redirect("/loginPage");
  }
  return next();
}

async function atualizaToken(refresh_token_param, res) {
  try {
    let response = await axios.post(
      `${protheusAuthUrl}/rest/api/oauth2/v1/token`,
      null,
      { params: { grant_type: "refresh_token", refresh_token: refresh_token_param } }
    );
    let { access_token, refresh_token } = response.data;
    res.cookie("token", access_token, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 3600000 });
    res.cookie("refresh_token", refresh_token, { httpOnly: true, secure: false, sameSite: "lax", maxAge: 43200000 });
    return access_token || null;
  } catch (error) {
    console.error("Erro ao atualizar token:", error.message);
    return null;
  }
}

async function buscarUsuarioDoToken(token) {
  const response = await axios.get(`${protheusAuthUrl}/rest/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000,
  });
  return response.data;
}

async function validarSessao(req, res) {
  const token = req.cookies && req.cookies.token;
  const refresh = req.cookies && req.cookies.refresh_token;
  if (!token && !refresh) return false;
  if (req.session.userID && req.session.username && (!token || token === req.session.authToken)) return true;

  let tokenAtual = token || await atualizaToken(refresh, res);
  if (!tokenAtual) return false;
  let usuario;
  try {
    usuario = await buscarUsuarioDoToken(tokenAtual);
  } catch (error) {
    if (!refresh || error.response?.status !== 401) return false;
    tokenAtual = await atualizaToken(refresh, res);
    if (!tokenAtual) return false;
    try {
      usuario = await buscarUsuarioDoToken(tokenAtual);
    } catch {
      return false;
    }
  }
  if (!usuario || !usuario.userID || !usuario.login) return false;

  req.session.userID = usuario.userID;
  req.session.username = usuario.login;
  req.session.nomeCompleto = usuario.nome || usuario.login;
  req.session.authToken = tokenAtual;
  return true;
}

module.exports = { validaLogin, verificarEAtualizarToken, validarSessao };
