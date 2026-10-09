#!/bin/sh
# GitHub Pages 公開前のローカル確認用：アプリ本体だけを dist/ にコピーする（docs・tests・説明書は公開しない）
set -e
rm -rf dist
mkdir dist
for p in *; do
  case "$p" in
    dist|docs|tests|scripts|node_modules|AGENTS.md|README.md|build.sh|codex_log*.txt|codex_result*.md|package.json|package-lock.json) continue ;;
  esac
  cp -R "$p" dist/
done
echo "dist/ に公開ファイルを用意しました:"
ls dist
