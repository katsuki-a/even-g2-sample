# Even G2 Image Viewer

スマートフォンで選んだ任意の画像を、Even Realities G2 に表示するためのシンプルなアプリです。画像は縦横比を維持して 200 × 100px に収め、実機で表示可能な 1bit モノクロ BMP に変換してから送信します。

## セットアップ

```bash
npm install
npm run dev
```

### シミュレータで確認

別のターミナルで以下を実行します。

```bash
npm run simulator -- "http://localhost:5173/?simulator=true"
```

ブラウザで `http://localhost:5173/?simulator=true` を開き、画像を選択して「G2へ送信」を押してください。

### G2 実機で確認

1. 開発用PCとスマートフォンを同じネットワークへ接続します。
2. スマートフォンの Even App と G2 を BLE 接続します。
3. `npm run dev` を起動します。
4. 別のターミナルで `npm run qr` を実行します。
5. 表示されたQRコードを Even App の Even Hub から読み取ります。

## 画像変換仕様

- 出力サイズ: 200 × 100px（余白は白）
- 形式: 1bit モノクロ BMP
- 配置: 縦横比を維持して中央配置
- 調整: 二値化しきい値、白黒反転

## 参考

- [Even Realities G2アプリのシンプルな開発方法をまとめてみました](https://www.crossroad-tech.com/entry/even-realities-G2-hello-world)
- [even_g2_simple_code](https://github.com/flushpot1125/even_g2_simple_code)
