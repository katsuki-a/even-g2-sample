# Fitness Harness

「圏外 / NO SERVICE」を完成形へ反復するための、依存ゼロのNode.js評価器です。

## 実行

```bash
npm test
npm run fitness
npm run loop:check

node harness/fitness.mjs --phase implementation
node harness/fitness.mjs --phase release --json
```

通常の段階は[`config.json`](./config.json)の`activePhase`で決まります。段階を先取りして実行すると、次に必要な作業をハードゲートとして確認できます。

## 評価対象

- `content/story.json`: 構文、参照、到達可能性、循環、表示長、全経路、ビート順
- `docs/`: 必須ドキュメント
- `src/`: 目標モジュール、依存境界、mainの行数、権限、テスト入口
- `evidence.json`: シミュレータ、実機、ユーザーテスト、人手物語評価

`concept`ではStoryとDocs、`implementation`ではArchitecture、`release`ではEvidenceが追加でハードゲートになります。低い段階へ戻して合格扱いにしてはいけません。

## 終了コード

- `0`: 対象段階のハードゲートなし、合計85点以上
- `1`: ハードゲートあり、設定不正、または85点未満

自動点を満たすためだけのダミーノード、無意味な分岐、空の必須ファイルは不合格です。自動評価が検出しにくい品質は`release`の人手証拠で補います。
