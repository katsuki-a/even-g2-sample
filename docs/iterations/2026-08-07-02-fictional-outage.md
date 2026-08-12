# Iteration 2026-08-07-02

## 仮説

現実の事件と一致する日時、実在地区、通りの状況を、架空都市の原因不明な広域停電へ置き換えれば、倫理・風評リスクを下げながら、ミナの死、非対称時間、`M-17`の構造的などんでん返しは維持できる。

## 対象

- 種別: story
- 適応度項目: Story / Temporal Mystery / Incident Distance
- 変更前スコア: Story 100/100。implementation全体はNarrativeレビュー5件未作成のため90/100・FAIL

## 変更

- 日付を2008年6月8日から2008年8月17日へ移した。
- 実在地区を、架空都市「東央市」の「北電気街」へ変更した。
- 人波、クラクション、倒れる音、サイレンを削除し、信号、看板、携帯、非常灯が順に停止する架空の「北電気街8・17停電」へ置き換えた。
- 人為的な襲撃や加害者を設定せず、地下設備の金属音、焦げた匂い、原因欄の空白でSFミステリーを作った。
- 退避選択を「裏口から離れて」から「地下から離れて」へ変更した。
- 事故翌日の画像名を`PIC_0609.BMP`から`PIC_0818.BMP`へ変更し、キャプションも`撮影 08/18 / 受信 08/20`へ合わせた。
- ストーリーバイブル、コンセプト、要件、リリース手順から現実の事件との対応を削除した。
- ミナの死亡、17台の回収端末、27分岐、28人目、3終端、END保持には触れていない。

## 自動評価

```text
npm run narrative:prepare
npm run build
node --no-warnings --experimental-transform-types --test src/*/*.test.ts
npm run simulator:evidence -- --route=012
```

- Story: 100/100、ハードゲート0、28ノード、27経路、経路長20、3終端
- Source test: 16/16 PASS
- Build: PASS
- Simulator 0.8.0: `012`の20ノード、4添付、`ending_recipient`、END保持、戻る終了がPASS
- `npm run loop:check`: 28/29テスト。独立Narrativeレビューの未作成または不正な`clicheSignals`によるconceptゲートだけが未完了
- 変更後スコア: implementation 90/100・FAIL（Narrative 0/100）。Story、Docs、Architectureは100/100

## Narrative Persona Review

- input digest:
  - casual-suspense-reader: `sha256:f94a50b8c906b23a06909cf2b846035573e8744ba6c4b4c88d2743db0161c72d`
  - genre-veteran: `sha256:39255d296c534572454734555f9858f6a875a6c2252828ba9b654e401f42557d`
  - interactive-fiction-designer: `sha256:faf92c299a5e081460212408a155d704e1670653a9a31b5c12854461c6ea12ea`
  - character-drama-reader: `sha256:c1817a77b9f9b86b3463a05dd381fa6db304aff43231d6b005fb4fe178747f24`
  - wearable-skeptic: `sha256:9bb1d7b58a0d593424844efd3b9ac9848f0dc79ffa18360543965acbf3493248`
- 人格数 / 経路数: verifier有効レビュー0/5、入力27経路を準備済み
- 面白さ / 非凡庸性 / 総合: 未採点
- 人格別点: 未採点
- 最低経路: 未採点
- 頻出するありがちな類型: 未採点
- 評価不一致: 未採点

## 人手確認

- 環境: Even Hub Simulator 0.8.0
- 操作列: `012`
- 観察: 改名後の4添付をすべて送信し、20/20ノードで`ending_recipient`へ到達した。ENDは決定後も保持され、戻る操作で終了した。
- 証拠: `output/simulator/smoke-012.json`、`output/simulator/route-012-ending_recipient-retained.png`

## 判断

- 採用
- 理由: 現実の事件と対応する固有要素を削除しても、死亡記録の矛盾と`M-17`の反転は失われず、Story適応度と実走経路を維持できた。
- 最大の残存リスク: 架空停電事故が単なる背景設定に見え、ミナ固有の生活感を弱める可能性
- 次の仮説: 独立NarrativeレビューでCharacter VoiceとTemporal Mysteryだけを確認し、停電説明を増やさずに弱い軸を補う。
