(function () {
  "use strict";

  const SESSION_KEY = "info_site_api_token_v1";
  const app = document.getElementById("app");

  const state = {
    activeView: "info",
    selectedPostId: "",
    postSearch: "",
    userSearch: "",
    flash: null,
    modal: null,
    token: localStorage.getItem(SESSION_KEY) || "",
    currentUser: null,
    posts: [],
    users: [],
    loading: true
  };

  const icons = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7"/><path d="m16 7 2 2"/><path d="m18 5 2 2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg>'
  };

  async function api(path, options) {
    const headers = {
      "Content-Type": "application/json",
      ...(options && options.headers ? options.headers : {})
    };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;

    const response = await fetch(path, {
      ...options,
      headers
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        state.token = "";
        state.currentUser = null;
        localStorage.removeItem(SESSION_KEY);
      }
      throw new Error(payload.error || "操作失败。");
    }

    return payload;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) return "未登录";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function roleLabel(role) {
    return role === "admin" ? "管理员" : "普通用户";
  }

  function statusLabel(status) {
    return status === "active" ? "启用" : "停用";
  }

  function setFlash(message, type) {
    state.flash = { message, type: type || "success" };
  }

  function clearFlash() {
    state.flash = null;
  }

  function flashHtml() {
    if (!state.flash) return "";
    return `<div class="flash ${state.flash.type}">${escapeHtml(state.flash.message)}</div>`;
  }

  function roleBadge(user) {
    const type = user.role === "admin" ? "admin" : "user";
    return `<span class="badge ${type}">${roleLabel(user.role)}</span>`;
  }

  async function loadPosts() {
    const payload = await api("/api/posts");
    state.posts = payload.posts || [];
  }

  async function loadUsers() {
    if (!state.currentUser || state.currentUser.role !== "admin") {
      state.users = [];
      return;
    }
    const payload = await api("/api/users");
    state.users = payload.users || [];
  }

  async function refreshData() {
    if (!state.currentUser) return;
    await loadPosts();
    if (state.currentUser.role === "admin") {
      await loadUsers();
    }
  }

  async function initialize() {
    if (!state.token) {
      state.loading = false;
      render();
      return;
    }

    try {
      const payload = await api("/api/me");
      state.currentUser = payload.user;
      state.activeView = state.currentUser.role === "admin" ? "publish" : "info";
      await refreshData();
    } catch (error) {
      setFlash(error.message || "请重新登录。", "error");
    } finally {
      state.loading = false;
      render();
    }
  }

  function renderLoading() {
    app.innerHTML = `
      <main class="login-page">
        <section class="login-art" aria-label="信息权限管理">
          <div class="brand">
            <span class="brand-mark">信</span>
            <span>信息权限管理网站</span>
          </div>
          <div class="login-title">
            <h1>正在连接</h1>
            <p>正在连接动态后端服务。</p>
          </div>
        </section>
        <section class="login-panel-wrap">
          <div class="login-panel">
            <h2>请稍候</h2>
            <p class="subtle">如果长时间没有响应，请确认 node server.js 已启动。</p>
          </div>
        </section>
      </main>
    `;
  }

  function renderLogin() {
    app.innerHTML = `
      <main class="login-page">
        <section class="login-art" aria-label="信息权限管理">
          <div class="brand">
            <span class="brand-mark">信</span>
            <span>信息权限管理网站</span>
          </div>
          <div class="login-title">
            <h1>账号登录</h1>
            <p>普通用户登录后进入信息浏览页；管理员登录后进入后台，可以发布信息并管理普通用户。</p>
          </div>
          <div class="credential-strip">
            <span>管理员：<code>tang</code> / <code>1101</code></span>
            <span>普通用户：<code>user</code> / <code>user123</code></span>
          </div>
        </section>
        <section class="login-panel-wrap">
          <div class="login-panel">
            <h2>登录</h2>
            <p class="subtle">请输入账号和密码</p>
            ${flashHtml()}
            <form id="login-form" class="form-grid">
              <div class="form-row">
                <label for="login-username">账号</label>
                <input class="field" id="login-username" name="username" autocomplete="username" required />
              </div>
              <div class="form-row">
                <label for="login-password">密码</label>
                <input class="field" id="login-password" name="password" type="password" autocomplete="current-password" required />
              </div>
              <div class="actions">
                <button class="btn btn-primary" type="submit">${icons.arrow}<span>进入系统</span></button>
              </div>
            </form>
          </div>
        </section>
      </main>
    `;
  }

  function renderShell(user) {
    const navItems = [
      { id: "info", label: "信息浏览", icon: icons.eye, roles: ["admin", "user"] },
      { id: "publish", label: "信息发布", icon: icons.file, roles: ["admin"] },
      { id: "users", label: "用户管理", icon: icons.users, roles: ["admin"] },
      { id: "password", label: "修改密码", icon: icons.key, roles: ["admin"] }
    ].filter((item) => item.roles.includes(user.role));

    if (!navItems.some((item) => item.id === state.activeView)) {
      state.activeView = user.role === "admin" ? "publish" : "info";
    }

    app.innerHTML = `
      <div class="shell role-${escapeHtml(user.role)}">
        <header class="topbar">
          <div class="brand">
            <span class="brand-mark">信</span>
            <span>信息权限管理网站</span>
          </div>
          <div class="account">
            <div class="account-name">
              <strong>${escapeHtml(user.name)}</strong>
              <span>${escapeHtml(user.username)} · ${roleLabel(user.role)}</span>
            </div>
            ${roleBadge(user)}
            <button class="icon-btn" type="button" data-action="logout" title="退出登录" aria-label="退出登录">${icons.logout}</button>
          </div>
        </header>
        <aside class="sidebar">
          <nav class="nav" aria-label="主导航">
            ${navItems
              .map(
                (item) => `
                  <button class="nav-btn ${state.activeView === item.id ? "active" : ""}" type="button" data-view="${item.id}">
                    ${item.icon}<span>${item.label}</span>
                  </button>
                `
              )
              .join("")}
          </nav>
        </aside>
        <main class="main">
          <div class="workspace">
            ${flashHtml()}
            ${renderActiveView(user)}
          </div>
        </main>
        ${renderModal()}
      </div>
    `;
  }

  function renderActiveView(user) {
    if (state.activeView === "publish" && user.role === "admin") return renderPublishView();
    if (state.activeView === "users" && user.role === "admin") return renderUsersView();
    if (state.activeView === "password") return renderPasswordView(user);
    return renderInfoView(user);
  }

  function filteredPosts() {
    const keyword = state.postSearch.trim().toLowerCase();
    if (!keyword) return state.posts;
    return state.posts.filter((post) => {
      return [post.title, post.category, post.content].some((field) => String(field).toLowerCase().includes(keyword));
    });
  }

  function ensureSelectedPost(posts) {
    if (!posts.length) {
      state.selectedPostId = "";
      return null;
    }
    const selected = posts.find((post) => post.id === state.selectedPostId);
    if (selected) return selected;
    state.selectedPostId = posts[0].id;
    return posts[0];
  }

  function renderInfoView(user) {
    const posts = filteredPosts();
    const selected = ensureSelectedPost(posts);
    const isAdmin = user.role === "admin";
    const totalUsers = isAdmin ? state.users.length : 0;
    const activeUsers = isAdmin ? state.users.filter((item) => item.status === "active").length : 0;
    const adminOverview = isAdmin
      ? `
        <section class="section-title">
          <div>
            <h2>信息浏览</h2>
            <p class="subtle">当前账号可浏览管理员发布的信息。</p>
          </div>
        </section>
        <section class="stats-row" aria-label="数据概览">
          <div class="stat"><span>已发布信息</span><strong>${state.posts.length}</strong></div>
          <div class="stat"><span>普通用户</span><strong>${totalUsers}</strong></div>
          <div class="stat"><span>启用账号</span><strong>${activeUsers}</strong></div>
        </section>
      `
      : "";

    return `
      ${adminOverview}
      <section class="split ${isAdmin ? "" : "user-info-only"}">
        <div class="tool-panel">
          <div class="info-toolbar">
            <h3>信息列表</h3>
            <div class="search-box">
              ${icons.search}
              <input class="field" id="post-search" data-input="postSearch" value="${escapeHtml(state.postSearch)}" placeholder="搜索标题、分类或内容" />
            </div>
          </div>
          <div class="info-list" style="margin-top: 14px;">
            ${
              posts.length
                ? posts.map((post) => renderPostItem(post)).join("")
                : '<div class="empty">暂无可浏览的信息</div>'
            }
          </div>
        </div>
        <article class="tool-panel detail">
          ${selected ? renderPostDetail(selected) : '<div class="empty">请选择一条信息</div>'}
        </article>
      </section>
      ${
        user.role === "admin"
          ? '<div class="actions"><button class="btn btn-primary" type="button" data-view="publish">' + icons.plus + "<span>发布新信息</span></button></div>"
          : ""
      }
    `;
  }

  function renderPostItem(post) {
    return `
      <button class="info-item ${state.selectedPostId === post.id ? "active" : ""}" type="button" data-action="select-post" data-id="${escapeHtml(post.id)}">
        <span class="info-item-title">
          <span>${escapeHtml(post.title)}</span>
          ${post.pinned ? '<span class="badge soft">置顶</span>' : ""}
        </span>
        <span class="info-meta">
          <span class="badge blue">${escapeHtml(post.category)}</span>
          <span>${formatDate(post.createdAt)}</span>
        </span>
      </button>
    `;
  }

  function renderPostDetail(post) {
    return `
      <div class="mini-meta">
        <span class="badge blue">${escapeHtml(post.category)}</span>
        ${post.pinned ? '<span class="badge soft">置顶</span>' : ""}
        <span>${formatDate(post.createdAt)}</span>
        <span>发布人：${escapeHtml(post.authorName || "管理员")}</span>
      </div>
      <h3 style="margin-top: 14px;">${escapeHtml(post.title)}</h3>
      <div class="detail-content">${escapeHtml(post.content)}</div>
    `;
  }

  function renderPublishView() {
    return `
      <section class="section-title">
        <div>
          <h2>信息发布</h2>
          <p class="subtle">管理员可发布、置顶和删除信息。</p>
        </div>
      </section>
      <section class="admin-grid">
        <form id="post-form" class="tool-panel">
          <h3>发布信息</h3>
          <div class="form-grid">
            <div class="form-row">
              <label for="post-title">标题</label>
              <input class="field" id="post-title" name="title" maxlength="60" required />
            </div>
            <div class="two-col">
              <div class="form-row">
                <label for="post-category">分类</label>
                <select class="select" id="post-category" name="category">
                  <option>通知</option>
                  <option>制度</option>
                  <option>流程</option>
                  <option>公告</option>
                </select>
              </div>
              <label class="check-row" style="align-self: end; min-height: 44px;">
                <input type="checkbox" name="pinned" />
                <span>置顶显示</span>
              </label>
            </div>
            <div class="form-row">
              <label for="post-content">内容</label>
              <textarea class="textarea" id="post-content" name="content" required></textarea>
            </div>
            <button class="btn btn-primary" type="submit">${icons.plus}<span>发布</span></button>
          </div>
        </form>
        <div class="tool-panel">
          <div class="table-toolbar">
            <h3>已发布信息</h3>
            <span class="badge green">${state.posts.length} 条</span>
          </div>
          <div class="table-wrap" style="margin-top: 14px;">
            <table>
              <thead>
                <tr>
                  <th>标题</th>
                  <th>分类</th>
                  <th>发布时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${
                  state.posts.length
                    ? state.posts
                        .map(
                          (post) => `
                            <tr>
                              <td>${escapeHtml(post.title)}</td>
                              <td><span class="badge blue">${escapeHtml(post.category)}</span></td>
                              <td>${formatDate(post.createdAt)}</td>
                              <td>${post.pinned ? '<span class="badge soft">置顶</span>' : '<span class="badge">普通</span>'}</td>
                              <td>
                                <div class="table-actions">
                                  <button class="icon-btn" type="button" data-action="toggle-pin" data-id="${escapeHtml(post.id)}" title="${post.pinned ? "取消置顶" : "置顶"}" aria-label="${post.pinned ? "取消置顶" : "置顶"}">${icons.check}</button>
                                  <button class="icon-btn" type="button" data-action="delete-post" data-id="${escapeHtml(post.id)}" title="删除信息" aria-label="删除信息">${icons.trash}</button>
                                </div>
                              </td>
                            </tr>
                          `
                        )
                        .join("")
                    : '<tr><td colspan="5">暂无发布信息</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function filteredUsers() {
    const keyword = state.userSearch.trim().toLowerCase();
    return state.users.filter((user) => {
      if (!keyword) return true;
      return [user.username, user.name, user.status].some((field) => String(field).toLowerCase().includes(keyword));
    });
  }

  function renderUsersView() {
    const users = filteredUsers();
    return `
      <section class="section-title">
        <div>
          <h2>用户管理</h2>
          <p class="subtle">管理员可创建普通用户，启停账号，重置密码和删除普通用户。</p>
        </div>
      </section>
      <section class="admin-grid">
        <form id="user-form" class="tool-panel">
          <h3>新增普通用户</h3>
          <div class="form-grid">
            <div class="form-row">
              <label for="new-name">姓名</label>
              <input class="field" id="new-name" name="name" maxlength="24" required />
            </div>
            <div class="form-row">
              <label for="new-username">账号</label>
              <input class="field" id="new-username" name="username" minlength="3" maxlength="24" autocomplete="off" required />
            </div>
            <div class="form-row">
              <label for="new-password">初始密码</label>
              <input class="field" id="new-password" name="password" type="password" minlength="4" required />
              <span class="hint">至少 4 位</span>
            </div>
            <button class="btn btn-primary" type="submit">${icons.plus}<span>创建用户</span></button>
          </div>
        </form>
        <div class="tool-panel">
          <div class="table-toolbar">
            <h3>普通用户</h3>
            <div class="search-box">
              ${icons.search}
              <input class="field" data-input="userSearch" value="${escapeHtml(state.userSearch)}" placeholder="搜索账号、姓名或状态" />
            </div>
          </div>
          <div class="table-wrap" style="margin-top: 14px;">
            <table>
              <thead>
                <tr>
                  <th>用户</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>最近登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${
                  users.length
                    ? users
                        .map(
                          (user) => `
                            <tr>
                              <td>
                                <strong>${escapeHtml(user.name)}</strong>
                                <div class="hint">${escapeHtml(user.username)}</div>
                              </td>
                              <td><span class="badge ${user.status === "active" ? "green" : "yellow"}">${statusLabel(user.status)}</span></td>
                              <td>${formatDate(user.createdAt)}</td>
                              <td>${formatDate(user.lastLogin)}</td>
                              <td>
                                <div class="table-actions">
                                  <button class="icon-btn" type="button" data-action="toggle-user" data-id="${escapeHtml(user.id)}" title="${user.status === "active" ? "停用账号" : "启用账号"}" aria-label="${user.status === "active" ? "停用账号" : "启用账号"}">${icons.shield}</button>
                                  <button class="icon-btn" type="button" data-action="open-reset-password" data-id="${escapeHtml(user.id)}" title="重置密码" aria-label="重置密码">${icons.key}</button>
                                  <button class="icon-btn" type="button" data-action="delete-user" data-id="${escapeHtml(user.id)}" title="删除用户" aria-label="删除用户">${icons.trash}</button>
                                </div>
                              </td>
                            </tr>
                          `
                        )
                        .join("")
                    : '<tr><td colspan="5">暂无普通用户</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function renderPasswordView(user) {
    return `
      <section class="section-title">
        <div>
          <h2>修改密码</h2>
          <p class="subtle">当前账号：${escapeHtml(user.username)}</p>
        </div>
      </section>
      <form id="password-form" class="tool-panel" style="max-width: 520px;">
        <h3>密码设置</h3>
        <div class="form-grid">
          <div class="form-row">
            <label for="old-password">原密码</label>
            <input class="field" id="old-password" name="oldPassword" type="password" autocomplete="current-password" required />
          </div>
          <div class="form-row">
            <label for="new-password-current">新密码</label>
            <input class="field" id="new-password-current" name="newPassword" type="password" autocomplete="new-password" minlength="4" required />
          </div>
          <div class="form-row">
            <label for="confirm-password">确认新密码</label>
            <input class="field" id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="4" required />
          </div>
          <button class="btn btn-primary" type="submit">${icons.lock}<span>保存密码</span></button>
        </div>
      </form>
    `;
  }

  function renderModal() {
    if (!state.modal) return "";
    if (state.modal.type === "resetPassword") {
      const user = state.users.find((item) => item.id === state.modal.userId);
      if (!user) return "";
      return `
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <form id="reset-password-form" class="modal">
            <h3 id="reset-title">重置 ${escapeHtml(user.name)} 的密码</h3>
            <div class="form-grid">
              <div class="form-row">
                <label for="reset-password">新密码</label>
                <input class="field" id="reset-password" name="password" type="password" minlength="4" required />
              </div>
              <div class="actions">
                <button class="btn btn-primary" type="submit">${icons.key}<span>确认重置</span></button>
                <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
              </div>
            </div>
          </form>
        </div>
      `;
    }
    return "";
  }

  function render() {
    if (state.loading) {
      renderLoading();
      return;
    }
    if (!state.currentUser) {
      renderLogin();
      return;
    }
    renderShell(state.currentUser);
  }

  async function runAction(action) {
    try {
      await action();
    } catch (error) {
      setFlash(error.message || "操作失败。", "error");
    } finally {
      render();
    }
  }

  async function login(form) {
    const formData = new FormData(form);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    state.token = payload.token;
    state.currentUser = payload.user;
    localStorage.setItem(SESSION_KEY, state.token);
    state.activeView = state.currentUser.role === "admin" ? "publish" : "info";
    state.selectedPostId = "";
    clearFlash();
    await refreshData();
  }

  async function createPost(form) {
    const formData = new FormData(form);
    await api("/api/posts", {
      method: "POST",
      body: JSON.stringify({
        title: String(formData.get("title") || "").trim(),
        category: String(formData.get("category") || "通知").trim(),
        content: String(formData.get("content") || "").trim(),
        pinned: formData.get("pinned") === "on"
      })
    });
    await loadPosts();
    setFlash("信息已发布。", "success");
  }

  async function createUser(form) {
    const formData = new FormData(form);
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim(),
        username: String(formData.get("username") || "").trim(),
        password: String(formData.get("password") || "")
      })
    });
    await loadUsers();
    setFlash("普通用户已创建。", "success");
  }

  async function changeOwnPassword(form) {
    const formData = new FormData(form);
    await api("/api/me/password", {
      method: "PATCH",
      body: JSON.stringify({
        oldPassword: String(formData.get("oldPassword") || ""),
        newPassword: String(formData.get("newPassword") || ""),
        confirmPassword: String(formData.get("confirmPassword") || "")
      })
    });
    setFlash("密码已修改。", "success");
  }

  async function resetUserPassword(form) {
    if (!state.modal) return;
    const password = String(new FormData(form).get("password") || "");
    await api(`/api/users/${encodeURIComponent(state.modal.userId)}/password`, {
      method: "PATCH",
      body: JSON.stringify({ password })
    });
    state.modal = null;
    setFlash("用户密码已重置。", "success");
  }

  function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();

    if (form.id === "login-form") {
      runAction(() => login(form));
      return;
    }

    if (form.id === "post-form") runAction(() => createPost(form));
    if (form.id === "user-form") runAction(() => createUser(form));
    if (form.id === "password-form") runAction(() => changeOwnPassword(form));
    if (form.id === "reset-password-form") runAction(() => resetUserPassword(form));
  }

  function handleClick(event) {
    const button = event.target.closest("button");
    if (!button) return;

    const view = button.dataset.view;
    const action = button.dataset.action;

    if (view) {
      state.activeView = view;
      clearFlash();
      render();
      return;
    }

    if (action === "logout") {
      runAction(async () => {
        await api("/api/logout", { method: "POST", body: "{}" });
        state.token = "";
        state.currentUser = null;
        state.posts = [];
        state.users = [];
        state.activeView = "info";
        state.selectedPostId = "";
        localStorage.removeItem(SESSION_KEY);
        clearFlash();
      });
      return;
    }

    if (action === "select-post") {
      state.selectedPostId = button.dataset.id || "";
      render();
      return;
    }

    if (action === "toggle-pin") {
      runAction(async () => {
        await api(`/api/posts/${encodeURIComponent(button.dataset.id || "")}/pin`, {
          method: "PATCH",
          body: "{}"
        });
        await loadPosts();
        setFlash("信息置顶状态已更新。", "success");
      });
      return;
    }

    if (action === "delete-post") {
      runAction(async () => {
        await api(`/api/posts/${encodeURIComponent(button.dataset.id || "")}`, {
          method: "DELETE"
        });
        if (state.selectedPostId === button.dataset.id) state.selectedPostId = "";
        await loadPosts();
        setFlash("信息已删除。", "success");
      });
      return;
    }

    if (action === "toggle-user") {
      runAction(async () => {
        await api(`/api/users/${encodeURIComponent(button.dataset.id || "")}/status`, {
          method: "PATCH",
          body: "{}"
        });
        await loadUsers();
        setFlash("用户状态已更新。", "success");
      });
      return;
    }

    if (action === "delete-user") {
      runAction(async () => {
        await api(`/api/users/${encodeURIComponent(button.dataset.id || "")}`, {
          method: "DELETE"
        });
        await loadUsers();
        setFlash("普通用户已删除。", "success");
      });
      return;
    }

    if (action === "open-reset-password") {
      state.modal = { type: "resetPassword", userId: button.dataset.id };
      clearFlash();
      render();
      return;
    }

    if (action === "close-modal") {
      state.modal = null;
      clearFlash();
      render();
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const key = target.dataset.input;
    if (!key || !(key in state)) return;
    state[key] = target.value;
    render();
    const refreshed = document.querySelector(`[data-input="${key}"]`);
    if (refreshed instanceof HTMLInputElement) {
      refreshed.focus();
      refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length);
    }
  }

  document.addEventListener("submit", handleSubmit);
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);

  render();
  initialize();
})();
