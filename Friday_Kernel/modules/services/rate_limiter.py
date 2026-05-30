#!/usr/bin/env python3
"""
Friday Rate Limiter — API 请求限流代理
==========================================
在本地启动一个 HTTP 代理，转发请求到目标 API，
同时按令牌桶算法限制请求速率。

用法：
  python rate_limiter.py --port 8099 --target https://integrate.api.nvidia.com/v1 --rpm 40

然后 OpenCode 里把英伟达的 baseURL 改为 http://localhost:8099/v1

作者：Friday Kernel
"""

import http.server
import json
import time
import threading
import urllib.request
import urllib.error
import sys
import argparse
from collections import deque


class TokenBucket:
    """
    令牌桶限流器
    - 每分钟最多 rpm 个请求
    - 超出限制的请求等待令牌可用
    """

    def __init__(self, rpm=40):
        self.rpm = rpm
        self.tokens = rpm  # 当前可用令牌数
        self.last_refill = time.time()
        self.lock = threading.Lock()
        self._refill()

    def _refill(self):
        """按时间补充令牌"""
        now = time.time()
        elapsed = now - self.last_refill
        # 每分钟补充 rpm 个令牌
        refill = elapsed * (self.rpm / 60.0)
        self.tokens = min(self.rpm, self.tokens + refill)
        self.last_refill = now

    def acquire(self, timeout=60):
        """
        获取一个令牌，最多等待 timeout 秒
        返回 True=获取成功, False=超时
        """
        start = time.time()
        while time.time() - start < timeout:
            with self.lock:
                self._refill()
                if self.tokens >= 1:
                    self.tokens -= 1
                    return True
            # 没令牌了，等一小会儿再试
            time.sleep(0.05)
        return False


class RateLimitedProxyHandler(http.server.BaseHTTPRequestHandler):
    """限流代理处理器"""

    # 类变量，所有实例共享
    bucket = None
    target_base = ""

    def log_message(self, format, *args):
        """日志输出"""
        print(f"  [{time.strftime('%H:%M:%S')}] {args[0]} {args[1]} {args[2]}")

    def do_HEAD(self):
        self._handle_request()

    def do_GET(self):
        self._handle_request()

    def do_POST(self):
        self._handle_request()

    def do_PUT(self):
        self._handle_request()

    def do_DELETE(self):
        self._handle_request()

    def _handle_request(self):
        """处理请求——带限流"""
        path = self.path
        method = self.command

        # 健康检查端点不限流
        if path in ["/health", "/v1/health"]:
            self._send_json(200, {"status": "ok", "rate_limit": f"{self.bucket.rpm} req/min"})
            return

        # 限流：获取令牌
        if not self.bucket.acquire(timeout=60):
            self._send_json(429, {
                "error": "rate_limit_exceeded",
                "message": f"Rate limit {self.bucket.rpm} req/min exceeded. Try again later."
            })
            return

        # 转发请求到目标
        target_url = f"{self.target_base}{path}"
        try:
            # 读取请求体
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b""

            # 构建转发请求
            req = urllib.request.Request(
                target_url,
                data=body if body else None,
                headers={k: v for k, v in self.headers.items()
                         if k.lower() not in ["host", "content-length"]},
                method=method,
            )

            # 发送请求
            with urllib.request.urlopen(req, timeout=120) as resp:
                response_body = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ["transfer-encoding", "content-encoding", "content-length"]:
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(response_body)))
                self.send_header("X-RateLimit-Limit", str(self.bucket.rpm))
                self.end_headers()
                self.wfile.write(response_body)

        except urllib.error.HTTPError as e:
            # 透传错误
            try:
                error_body = e.read()
                self.send_response(e.code)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(error_body)
            except Exception:
                self._send_json(e.code, {"error": str(e)})

        except Exception as e:
            self._send_json(502, {"error": f"Proxy error: {str(e)}"})

    def _send_json(self, status, data):
        """发送 JSON 响应"""
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description="API 请求限流代理")
    parser.add_argument("--port", type=int, default=8099, help="本地监听端口")
    parser.add_argument("--target", default="https://integrate.api.nvidia.com/v1",
                        help="目标 API 地址")
    parser.add_argument("--rpm", type=int, default=40, help="每分钟最大请求数")
    args = parser.parse_args()

    # 配置限流器
    RateLimitedProxyHandler.bucket = TokenBucket(rpm=args.rpm)
    RateLimitedProxyHandler.target_base = args.target.rstrip("/")

    # 启动服务器
    server = http.server.HTTPServer(("127.0.0.1", args.port), RateLimitedProxyHandler)

    print("=" * 56)
    print(f"  Friday Rate Limiter")
    print("=" * 56)
    print(f"  监听地址:  http://127.0.0.1:{args.port}")
    print(f"  转发目标:  {args.target}")
    print(f"  速率限制:  {args.rpm} 次/分钟")
    print()
    print(f"  在 OpenCode 中设置:")
    print(f"  baseURL → http://127.0.0.1:{args.port}")
    print()
    print(f"  按 Ctrl+C 停止")
    print("=" * 56)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  停止中...")
        server.shutdown()
        print("  已停止")


if __name__ == "__main__":
    main()
