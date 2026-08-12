# Iteration 2026-08-07-03

## 仮説

構造ゲートを通った全経路を複数の独立ペルソナが共通基準で採点し、物語・人格・評価指示のdigest付き証跡を決定論的に集約すれば、「構造100点だが面白さや非凡庸性が弱い」状態をループ内で検出できる。

## 対象

- 種別: story / architecture
- 適応度項目: Narrative Persona / Story / Docs / Architecture
- 変更前スコア: implementation 100/100、Narrative評価器なし

## 変更

- 全完走経路を選択ノードIDとchoice IDの組で一意に列挙し、固定テンプレート値でブラインド評価パケットを生成するCLIを追加した。
- 通勤読者、ジャンル批評家、インタラクティブ物語設計者、人物ドラマ読者、ウェアラブル懐疑派の5人格を定義した。
- 面白さ5軸、非凡庸性5軸、6つの凡庸さ強制テスト、統制されたcliche signalsを共通ルーブリックへ定義した。
- 5人格すべてを独立sub-agentとして実行し、各人格が全27経路・270採点欄・根拠ノード・理由を別JSONへ保存した。
- 物語、人格、ルーブリック、共通プロトコル、全経路をSHA-256化し、変更後のレビュー使い回しを拒否するようにした。
- 人格内は全経路平均、人格間と経路別合議は中央値とし、最低経路、頻出類型、選択の持続率、3人格以上が検出した強制テストを集計した。
- Narrativeをfitnessの独立コンポーネントへ追加した。implementationでは警告と点数、`narrative:verify`、`loop:check:narrative`、releaseでは品質ハードゲートとして扱う。
- 不正型、経路欠落、古いdigest、根拠重複、choice ID重複、route ID衝突、必須人格不足、中央値、強制テスト合意を自動テストへ追加した。

## 自動評価

```text
npm run loop:check
npm run narrative:verify
```

- `loop:check`: PASS
- Test: 38/38
- Build: TypeScript / Vite成功
- implementation: 95/100、PASS
- Story: 100/100、28ノード、27経路、3終端
- Narrative: 52/100、implementationでは品質不足10件をwarningとして表示
- `narrative:verify`: 意図どおりFAIL。面白さ、非凡庸性、総合、最低経路、5人格の凡庸合意、4種類の強制テスト合意がハードゲートになった。
- 変更後スコア: implementation 95/100

## Narrative Persona Review

- story SHA-256: `6fa798ae02e46e24c2f38b8c1b5262fcba88df59b65ae9074b6153405da8df54`
- 人格別input digest: 各レビューJSONの`inputDigest`に記録
- 人格数 / 経路数: 5/5人格、27/27経路、135/135人格×経路
- 面白さ / 非凡庸性 / 総合: 58.3 / 46.1 / 52.2
- 人格別総合: 通勤読者56.7、ジャンル批評家46.7、物語設計者58.3、人物ドラマ読者51.9、ウェアラブル懐疑派51.7
- 最低経路: `choice_year=wrong_address--choice_safety=avoid_back_door--choice_final=ask_recipient`、45/100
- 最高経路群: `choice_year=ask_mina`かつ`choice_final=return_name`、62.5/100
- 頻出するありがちな類型: `simulated-choice` 5/5人格、`message-to-next-reader` 5/5人格、`creepy-technology` 3/5人格
- 3人格以上が検出した強制テスト: choice erasure 5/5、character swap 5/5、device swap 5/5、ending paraphrase 4/5
- 評価不一致: 最大人格差11.6点で、30点の要裁定閾値未満

## 人手確認

- 環境: 5つの独立Codex sub-agent、ブラインド経路パケット
- 操作列: 各人格へ担当パケットと空テンプレートだけを渡し、他人格の点数と作者資料を非開示にした。
- 観察: 全人格が導入と推進力を相対的に評価した一方、最初の2選択が一通後に合流すること、ミナ固有の声が弱いこと、スマートフォンへ置換できることを共通の弱点とした。「ミナの名を返して」終端は全人格で最も固有性が高かった。
- 証拠: `harness/narrative/reviews/*.json`

## 判断

- 採用
- 理由: Story構造100点では見えなかった面白さ58.3、非凡庸性46.1、選択持続率1/3を、人格別根拠とともに再現可能なゲートとして検出できた。
- 最大の残存リスク: LLM評価は実ユーザー反応の代替ではなく、低評価軸を直す台詞・分岐変更は全レビューを失効させるため再評価コストがある。
- 次の仮説: 最初の2選択の影響をAct 3まで残し、ミナ固有の生活記憶を反転後の倫理へ接続し、G2の視界内受信を代償へ変えれば、choice tension、voice specificity、device integrationを同時に上げず一軸ずつ改善できる。
