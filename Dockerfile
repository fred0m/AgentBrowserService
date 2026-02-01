# 必须使用 Playwright 官方基础镜像，版本需匹配
FROM mcr.microsoft.com/playwright:v1.58.1-jammy

# 设置工作目录
WORKDIR /app

# 安装 Node.js 依赖
COPY package.json ./
# 如果有 package-lock.json 也应该复制，目前暂无
RUN npm install

# 复制源代码
COPY tsconfig.json ./
COPY src ./src

# 编译 TypeScript
RUN npm run build

# 创建数据目录并调整权限
# 必须兼容宿主机 UID/GID=1000 (mom 1000:1000)
# 容器启动时可能挂载了 volumes，所以这里只是做个预备，实际权限可能需要在 entrypoint 或运行时处理，
# 但按照最佳实践，如果宿主机目录权限正确，容器内以 uid 1000 运行即可。
RUN mkdir -p /data && chown -R 1000:1000 /data /app

# 覆盖 ENTRYPOINT 以避免基础镜像的默认行为导致冲突
ENTRYPOINT []

# 切换到非 root 用户 (pwuser 是 playwright 镜像默认的非 root 用户，通常是 1000:1000，但为了保险我们直接指定)
# 注意：Playwright 镜像中的 pwuser uid 可能是 1000，但也可能不是，我们应当检查一下或直接使用 --user 1000:1000 启动。
# 在 Dockerfile 里 USER 指令切换用户。
# 为了最大兼容性，我们在 docker run 时指定 --user 1000:1000，这里先保留默认或切换到 pwuser。
# 官方镜像通常有 pwuser，我们这里不做硬性 USER 切换，依靠 docker-compose 的 user: 1000:1000。

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["node", "dist/index.js"]
