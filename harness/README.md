# Fitness Harness

「圏外 / NO SERVICE」を完成形へ反復するための、依存ゼロのNode.js評価器です。

## 実行

```bash
npm test
npm run fitness
npm run loop:check

node harness/fitness.mjs --phase implementation
node harness/fitness.mjs --phase release --json
npm run narrative:prepare
npm run narrative:verify
npm run loop:check:narrative
```

通常の段階は[`config.json`](./config.json)の`activePhase`で決まります。段階を先取りして実行すると、次に必要な作業をハードゲートとして確認できます。

## 評価対象

- `content/story.json`: 構文、参照、到達可能性、循環、表示長、全経路、ビート順
- `narrative/`: 5つの独立ペルソナ、共通ルーブリック、全27経路の根拠付きレビュー
- `docs/`: 必須ドキュメント
- `src/`: 目標モジュール、依存境界、mainの行数、権限、テスト入口
- `evidence.json`: シミュレータ、実機、ユーザーテスト、人手物語評価

`concept`ではStory、Narrative、Docs、`implementation`ではArchitecture、`release`ではEvidenceとNarrative品質閾値がハードゲートになります。低い段階へ戻して合格扱いにしてはいけません。

## Narrative Persona Review

`npm run narrative:prepare`は、テンプレート値を固定して全完走経路を列挙し、`output/narrative/`へ人格別パケットとJSONテンプレートを生成します。親agentは次の5人格を互いの点数が見えない独立sub-agentとして実行します。

- 通勤中のサスペンス読者
- SF・ホラー多読の辛口批評家
- インタラクティブ物語設計者
- 人物ドラマ重視の読者
- ウェアラブル懐疑派

完成した生レビューだけを`harness/narrative/reviews/`へ保存します。CIはagentを再実行せず、物語・人格・ルーブリック・共通レビュープロトコル・全トランスクリプトのSHA-256、5人格、27経路、採点範囲、根拠ノードを決定論的に再検証します。台詞、基準、人格、評価指示のいずれかが変わると`NARRATIVE_REVIEW_STALE`で失敗するため、レビューの使い回しはできません。

経路IDは`choice_year=tell_year--choice_safety=call_emergency--choice_final=return_name`のように選択ノードIDと選択肢IDの組で作ります。同じ選択ノード内のchoice ID重複と、生成後の経路ID衝突はハードゲートです。

`narrative:verify`と`loop:check:narrative`は品質閾値まで即時にハードゲート化します。通常のimplementation fitnessでは同じ不足を警告と点数へ反映し、release fitnessでハードゲートにします。sub-agent評価は早い反復用であり、5人ユーザーテストや人手評価の代替ではありません。

## 終了コード

- `0`: 対象段階のハードゲートなし、合計85点以上
- `1`: ハードゲートあり、設定不正、または85点未満

自動点を満たすためだけのダミーノード、無意味な分岐、空の必須ファイルは不合格です。自動評価が検出しにくい品質は`release`の人手証拠で補います。
