#!/usr/bin/env python3
"""
Friday Modules — 模块包初始化
===============================
自动修复 Windows SSL 证书问题，确保所有子模块的网络请求正常。
"""

import os

# ============ 全局 SSL 证书修复 ============
# 修复 Windows 上 Python 3.14 找不到根证书的问题
_local_cert = os.path.join(
    os.environ.get("LOCALAPPDATA", ""), ".certifi", "cacert.pem"
)
if os.path.exists(_local_cert):
    os.environ.setdefault("SSL_CERT_FILE", _local_cert)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _local_cert)
else:
    # 尝试生成
    try:
        import certifi_win32.wincerts as wincerts
        wincerts.generate_pem()
        if os.path.exists(wincerts.PEM_PATH):
            os.environ.setdefault("SSL_CERT_FILE", wincerts.PEM_PATH)
            os.environ.setdefault("REQUESTS_CA_BUNDLE", wincerts.PEM_PATH)
    except Exception:
        pass

__all__ = [
    "semantic_index",
    "friday_knowledge",
    "local_llm",
]
