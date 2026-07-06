FROM golang:1.25.0 as builder

# 设置工作目录
WORKDIR /app

# 设置GOPROXY为中国大陆代理
ENV GOPROXY=https://goproxy.cn,direct

# 安装构建依赖(使用阿里云Debian镜像源)
RUN echo "deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free\n\
deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free\n\
deb https://mirrors.aliyun.com/debian-security bookworm-security main" > /etc/apt/sources.list && \
    apt-get update -o Acquire::Retries=3 -o Acquire::http::Timeout=10 && \
    apt-get install -y --no-install-recommends gcc libc6-dev make && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 复制go.mod和go.sum文件
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建应用：生成 Swagger 文档 + CGO 静态编译
RUN go install github.com/swaggo/swag/cmd/swag@v1.16.4 && \
    swag init -g router/main.go --output docs/ && \
    CGO_ENABLED=1 go build -a -o /app/53AIHub -ldflags '-extldflags "-static"' .

# 使用精简的Alpine镜像作为运行时
FROM alpine:3.18

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy

# 安装SQLite运行时依赖和C库（添加wget用于健康检查）
RUN apk --no-cache add ca-certificates sqlite libc6-compat wget curl

# Preload tiktoken encodings for offline/runtime startup.
ENV TIKTOKEN_CACHE_DIR=/app/tiktoken-cache
RUN mkdir -p "${TIKTOKEN_CACHE_DIR}" && \
    curl -fsSL "https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken" \
      -o "${TIKTOKEN_CACHE_DIR}/9b5ad71b2ce5302211f9c61530b329a4922fc6a4" && \
    curl -fsSL "https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken" \
      -o "${TIKTOKEN_CACHE_DIR}/fb374d419588a4632f3f557e76b4b70aebbca790"

# 从构建阶段复制可执行文件
COPY --from=builder /app/53AIHub /app/53AIHub

# 暴露端口
EXPOSE 3000

# 健康检查配置
# 每30秒检查一次，超时10秒，启动后等待40秒再开始检查，连续3次失败则标记为不健康
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# 设置启动命令
CMD ["/app/53AIHub"]
