const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || ROOT;
const DATA_FILE = path.join(DATA_DIR, "data.json");
const PORT = Number(process.env.PORT || 5500);
const HOST = process.env.HOST || "0.0.0.0";
const sessions = new Map();

const staticFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
  ["/README.md", "README.md"]
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function defaultData() {
  return {
    users: [
      {
        id: "admin-001",
        username: "tang",
        name: "系统管理员",
        passwordHash: hashPassword("1101"),
        role: "admin",
        status: "active",
        createdAt: "2026-05-30T09:00:00.000Z",
        lastLogin: ""
      },
      {
        id: "user-001",
        username: "user",
        name: "普通用户",
        passwordHash: hashPassword("user123"),
        role: "user",
        status: "active",
        createdAt: "2026-05-30T09:10:00.000Z",
        lastLogin: ""
      },
      {
        id: "user-002",
        username: "lihua",
        name: "李华",
        passwordHash: hashPassword("user123"),
        role: "user",
        status: "active",
        createdAt: "2026-05-30T09:20:00.000Z",
        lastLogin: ""
      }
    ],
    posts: [
      {
        id: "post-001",
        title: "五月份系统维护通知",
        category: "通知",
        content:
          "本周六 22:00 至 23:00 将进行例行系统维护。维护期间可能出现短暂访问波动，请提前保存正在编辑的信息。",
        pinned: true,
        createdAt: "2026-05-28T08:30:00.000Z",
        authorId: "admin-001",
        visibleToUserIds: ["user-001", "user-002"]
      },
      {
        id: "post-002",
        title: "资料提交规范更新",
        category: "制度",
        content:
          "从 6 月 1 日起，所有资料提交需要包含负责人、提交日期和版本号。管理员会在信息页同步最新模板。",
        pinned: false,
        createdAt: "2026-05-27T10:15:00.000Z",
        authorId: "admin-001",
        visibleToUserIds: ["user-001", "user-002"]
      },
      {
        id: "post-003",
        title: "新员工账号开通流程",
        category: "流程",
        content:
          "部门负责人提交账号申请后，管理员会在后台创建普通用户账号，并将初始密码单独发送给本人。",
        pinned: false,
        createdAt: "2026-05-25T02:00:00.000Z",
        authorId: "admin-001",
        visibleToUserIds: ["user-001", "user-002"]
      }
    ]
  };
}

function normalizeData(data) {
  const normalized = {
    users: Array.isArray(data.users) ? data.users : [],
    posts: Array.isArray(data.posts) ? data.posts : []
  };

  normalized.users.forEach((user) => {
    if (user.password && !user.passwordHash) {
      user.passwordHash = hashPassword(user.password);
    }
    delete user.password;
    user.status = user.status || "active";
    user.role = user.role || "user";
    user.createdAt = user.createdAt || nowIso();
    user.lastLogin = user.lastLogin || "";
  });

  if (!normalized.users.some((user) => user.role === "admin")) {
    normalized.users.unshift(defaultData().users[0]);
  }

  const regularUserIds = normalized.users
    .filter((user) => user.role === "user")
    .map((user) => user.id);
  normalized.posts.forEach((post) => {
    post.pinned = Boolean(post.pinned);
    post.createdAt = post.createdAt || nowIso();
    if (!Array.isArray(post.visibleToUserIds)) {
      post.visibleToUserIds = [...regularUserIds];
      return;
    }
    post.visibleToUserIds = post.visibleToUserIds.filter((userId, index, list) => {
      return regularUserIds.includes(userId) && list.indexOf(userId) === index;
    });
  });

  return normalized;
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seeded = defaultData();
    writeData(seeded);
    return seeded;
  }

  try {
    const data = normalizeData(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
    writeData(data);
    return data;
  } catch (error) {
    const backupFile = `${DATA_FILE}.${Date.now()}.bak`;
    fs.copyFileSync(DATA_FILE, backupFile);
    const seeded = defaultData();
    writeData(seeded);
    return seeded;
  }
}

function writeData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, password, ...safeUser } = user;
  return safeUser;
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  json(res, 404, { error: "未找到请求的资源。" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("请求内容过大。"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("请求内容不是有效 JSON。"));
      }
    });
    req.on("error", reject);
  });
}

function getToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length);
}

function getCurrentUser(req, data) {
  const userId = sessions.get(getToken(req));
  if (!userId) return null;
  return data.users.find((user) => user.id === userId && user.status === "active") || null;
}

function requireUser(req, res, data) {
  const user = getCurrentUser(req, data);
  if (!user) {
    json(res, 401, { error: "请先登录。" });
    return null;
  }
  return user;
}

function requireAdmin(req, res, data) {
  const user = requireUser(req, res, data);
  if (!user) return null;
  if (user.role !== "admin") {
    json(res, 403, { error: "没有管理员权限。" });
    return null;
  }
  return user;
}

function sortedPosts(data) {
  return [...data.posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function regularUsers(data) {
  return data.users.filter((user) => user.role === "user");
}

function validVisibleUserIds(data, userIds) {
  if (!Array.isArray(userIds)) return [];
  const allowedUserIds = new Set(regularUsers(data).map((user) => user.id));
  return userIds.filter((userId, index, list) => {
    return allowedUserIds.has(userId) && list.indexOf(userId) === index;
  });
}

function canUserSeePost(user, post) {
  if (user.role === "admin") return true;
  return Array.isArray(post.visibleToUserIds) && post.visibleToUserIds.includes(user.id);
}

function postsWithAuthor(data, currentUser) {
  return sortedPosts(data).filter((post) => canUserSeePost(currentUser, post)).map((post) => {
    const author = data.users.find((user) => user.id === post.authorId);
    const visibleUsers = regularUsers(data).filter((user) => post.visibleToUserIds.includes(user.id));
    const adminFields =
      currentUser.role === "admin"
        ? {
            visibleToUserIds: post.visibleToUserIds,
            visibleUserNames: visibleUsers.map((user) => user.name)
          }
        : {};
    return {
      ...post,
      ...adminFields,
      authorName: author ? author.name : "管理员"
    };
  });
}

async function handleApi(req, res, pathname) {
  const data = readData();

  if (req.method === "POST" && pathname === "/api/login") {
    const body = await readBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const user = data.users.find((item) => item.username === username);

    if (!user || user.passwordHash !== hashPassword(password)) {
      json(res, 401, { error: "账号或密码错误。" });
      return;
    }

    if (user.status !== "active") {
      json(res, 403, { error: "该账号已停用，请联系管理员。" });
      return;
    }

    user.lastLogin = nowIso();
    writeData(data);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, user.id);
    json(res, 200, { token, user: sanitizeUser(user) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    sessions.delete(getToken(req));
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/me") {
    const user = requireUser(req, res, data);
    if (!user) return;
    json(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/posts") {
    const user = requireUser(req, res, data);
    if (!user) return;
    json(res, 200, { posts: postsWithAuthor(data, user) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/posts") {
    const user = requireAdmin(req, res, data);
    if (!user) return;
    const body = await readBody(req);
    const title = String(body.title || "").trim();
    const category = String(body.category || "通知").trim();
    const content = String(body.content || "").trim();
    const visibleToUserIds = validVisibleUserIds(data, body.visibleToUserIds);

    if (!title || !content) {
      json(res, 400, { error: "标题和内容不能为空。" });
      return;
    }

    const post = {
      id: createId("post"),
      title,
      category,
      content,
      pinned: Boolean(body.pinned),
      createdAt: nowIso(),
      authorId: user.id,
      visibleToUserIds
    };
    data.posts.push(post);
    writeData(data);
    json(res, 201, { post: { ...post, authorName: user.name } });
    return;
  }

  const postPinMatch = pathname.match(/^\/api\/posts\/([^/]+)\/pin$/);
  if (req.method === "PATCH" && postPinMatch) {
    const user = requireAdmin(req, res, data);
    if (!user) return;
    const post = data.posts.find((item) => item.id === decodeURIComponent(postPinMatch[1]));
    if (!post) {
      notFound(res);
      return;
    }
    post.pinned = !post.pinned;
    writeData(data);
    json(res, 200, { post: { ...post, authorName: user.name } });
    return;
  }

  const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (req.method === "DELETE" && postMatch) {
    const user = requireAdmin(req, res, data);
    if (!user) return;
    const postId = decodeURIComponent(postMatch[1]);
    const nextPosts = data.posts.filter((post) => post.id !== postId);
    if (nextPosts.length === data.posts.length) {
      notFound(res);
      return;
    }
    data.posts = nextPosts;
    writeData(data);
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/users") {
    const user = requireAdmin(req, res, data);
    if (!user) return;
    json(res, 200, {
      users: data.users.filter((item) => item.role === "user").map(sanitizeUser)
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/users") {
    const user = requireAdmin(req, res, data);
    if (!user) return;
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!name || !username || password.length < 4) {
      json(res, 400, { error: "请填写完整用户信息，密码至少 4 位。" });
      return;
    }

    if (data.users.some((item) => item.username.toLowerCase() === username.toLowerCase())) {
      json(res, 409, { error: "账号已存在。" });
      return;
    }

    const newUser = {
      id: createId("user"),
      username,
      name,
      passwordHash: hashPassword(password),
      role: "user",
      status: "active",
      createdAt: nowIso(),
      lastLogin: ""
    };
    data.users.push(newUser);
    writeData(data);
    json(res, 201, { user: sanitizeUser(newUser) });
    return;
  }

  const userStatusMatch = pathname.match(/^\/api\/users\/([^/]+)\/status$/);
  if (req.method === "PATCH" && userStatusMatch) {
    const user = requireAdmin(req, res, data);
    if (!user) return;
    const managedUser = data.users.find(
      (item) => item.id === decodeURIComponent(userStatusMatch[1]) && item.role === "user"
    );
    if (!managedUser) {
      notFound(res);
      return;
    }
    managedUser.status = managedUser.status === "active" ? "disabled" : "active";
    writeData(data);
    json(res, 200, { user: sanitizeUser(managedUser) });
    return;
  }

  const userPasswordMatch = pathname.match(/^\/api\/users\/([^/]+)\/password$/);
  if (req.method === "PATCH" && userPasswordMatch) {
    const user = requireAdmin(req, res, data);
    if (!user) return;
    const body = await readBody(req);
    const password = String(body.password || "");
    if (password.length < 4) {
      json(res, 400, { error: "新密码至少 4 位。" });
      return;
    }
    const managedUser = data.users.find(
      (item) => item.id === decodeURIComponent(userPasswordMatch[1]) && item.role === "user"
    );
    if (!managedUser) {
      notFound(res);
      return;
    }
    managedUser.passwordHash = hashPassword(password);
    writeData(data);
    json(res, 200, { ok: true });
    return;
  }

  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (req.method === "DELETE" && userMatch) {
    const user = requireAdmin(req, res, data);
    if (!user) return;
    const userId = decodeURIComponent(userMatch[1]);
    const nextUsers = data.users.filter((item) => item.id !== userId || item.role !== "user");
    if (nextUsers.length === data.users.length) {
      notFound(res);
      return;
    }
    data.users = nextUsers;
    writeData(data);
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "PATCH" && pathname === "/api/me/password") {
    const user = requireUser(req, res, data);
    if (!user) return;
    const body = await readBody(req);
    const oldPassword = String(body.oldPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (user.passwordHash !== hashPassword(oldPassword)) {
      json(res, 400, { error: "原密码不正确。" });
      return;
    }

    if (newPassword.length < 4) {
      json(res, 400, { error: "新密码至少 4 位。" });
      return;
    }

    if (newPassword !== confirmPassword) {
      json(res, 400, { error: "两次输入的新密码不一致。" });
      return;
    }

    user.passwordHash = hashPassword(newPassword);
    writeData(data);
    json(res, 200, { ok: true });
    return;
  }

  notFound(res);
}

function serveStatic(req, res, pathname) {
  const fileName = staticFiles.get(pathname);
  if (!fileName) {
    notFound(res);
    return;
  }

  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) {
    notFound(res);
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-cache"
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }
    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res, pathname);
      return;
    }
    notFound(res);
  } catch (error) {
    json(res, 500, { error: error.message || "服务器处理失败。" });
  }
});

readData();
server.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "服务器IP或域名" : HOST;
  console.log(`动态网站已启动：http://${displayHost}:${PORT}/index.html`);
});
