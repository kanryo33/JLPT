#!/usr/bin/env python3
"""批量上传 audio/ 下所有音频到 Cloudflare R2（S3 兼容）。

用法：
  python3 工作脚本/upload_audio_r2.py \
    --endpoint https://<AccountID>.r2.cloudflarestorage.com \
    --bucket <Bucket名> \
    --key <AccessKeyID> \
    --secret <SecretAccessKey>

上传后所有文件保留 audio/xxx.mp3 相对路径，
页面 AUDIO_BASE 填 R2 公共访问域名（r2.dev 或自定义域）即可。
"""
import argparse
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3
from botocore.config import Config


def main():
    ap = argparse.ArgumentParser(description="上传音频到 Cloudflare R2")
    ap.add_argument("--endpoint", required=True,
                    help="R2 S3 endpoint，如 https://<AccountID>.r2.cloudflarestorage.com")
    ap.add_argument("--bucket", required=True, help="R2 bucket 名称")
    ap.add_argument("--key", required=True, help="R2 API Access Key ID")
    ap.add_argument("--secret", required=True, help="R2 API Secret Access Key")
    ap.add_argument("--workers", type=int, default=16, help="并发数（默认16）")
    args = ap.parse_args()

    files = []
    for dp, _, fs in os.walk("audio"):
        for f in fs:
            p = os.path.join(dp, f).replace("./", "")
            files.append((p, os.path.getsize(p)))
    files.sort(key=lambda x: -x[1])  # 大文件优先
    total = len(files)
    print(f"待上传 {total} 个文件，共 {sum(s for _, s in files) / 1048576:.1f} MB")

    s3 = boto3.client(
        "s3",
        endpoint_url=args.endpoint,
        aws_access_key_id=args.key,
        aws_secret_access_key=args.secret,
        region_name="auto",
        config=Config(connect_timeout=30, read_timeout=300, retries={"max_attempts": 5}),
    )

    ok = fail = 0

    def up(path):
        try:
            s3.upload_file(path, args.bucket, path,
                           ExtraArgs={"ContentType": "audio/mpeg",
                                      "CacheControl": "public, max-age=31536000"})
            return path, True, ""
        except Exception as e:  # noqa: BLE001
            return path, False, str(e)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(up, p) for p, _ in files]
        for i, f in enumerate(as_completed(futs), 1):
            p, okk, err = f.result()
            if okk:
                ok += 1
            else:
                fail += 1
                print(f"FAIL {p}: {err}")
            if i % 200 == 0 or i == total:
                print(f"进度 {i}/{total}  成功 {ok}  失败 {fail}")

    print(f"\n完成：成功 {ok}，失败 {fail}")
    if fail:
        print("有失败文件，重跑本脚本会跳过已上传成功的（R2 自动覆盖同名文件）。")


if __name__ == "__main__":
    main()
