# 服务器部署说明

这个项目已经可以部署到真正的服务器上运行。部署后，浏览器访问服务器 IP 或域名即可使用。

## 服务器要求

- 已安装 Node.js 18 或更高版本
- 服务器防火墙放行网站端口，例如 5500

## 上传文件

把整个项目文件夹上传到服务器，例如：

```text
/www/info-site
```

## 启动服务

进入项目目录后运行：

```bash
npm start
```

或：

```bash
node server.js
```

默认监听端口是 `5500`，默认监听地址是 `0.0.0.0`，表示允许外部浏览器访问。

## 访问地址

如果服务器公网 IP 是 `1.2.3.4`，访问：

```text
http://1.2.3.4:5500/index.html
```

如果绑定了域名，例如 `example.com`，访问：

```text
http://example.com:5500/index.html
```

## 默认管理员

```text
账号：tang
密码：1101
```

## 数据保存位置

用户、密码哈希、发布信息保存在服务器项目目录的：

```text
data.json
```

浏览器只保存登录令牌，业务数据不再保存在浏览器本地。

## Render 部署

如果使用 Render：

1. 把项目上传到 GitHub。
2. 在 Render 创建 Web Service 或 Blueprint。
3. 选择这个 GitHub 仓库。
4. Render 会读取 `render.yaml`。
5. 部署完成后访问 Render 生成的 `onrender.com` 地址。

注意：当前 `render.yaml` 使用 Render 免费 Web Service，部署后可以获得公网地址。免费服务的文件系统不是长期持久化存储，如果希望用户和信息长期保存，需要后续改为 Render Disk 付费实例或数据库。
