# Iteration 2026-08-06-03

## 仮説

返信候補をSimulatorで不安定なネイティブListから、単一のイベント捕捉TextContainerと差分更新カーソルへ置き換えれば、最終`dist`を人の読書速度で操作した全27経路を入力再送なしで完走できる。

## 対象

- 種別: renderer / input / resilience
- 適応度項目: Release Evidence / Simulator
- 変更前スコア: release 65/100、Simulator partial、P1 1件

## 変更

- 返信UIを`>`カーソル付きTextContainerへ変更し、上下操作時は`textContainerUpgrade`だけを送るようにした。
- 明示的な`evidenceCase`クエリでだけ有効になる構造化証跡rendererを追加し、通常の保存キーからcaseごとの進行状態を分離した。
- 最終`dist`、Even Hub SimulatorのAutomation API、構造化コンソールログを接続する`scripts/verify-simulator.mjs`を追加した。
- 27選択列を毎回初期状態から走査し、各14ノード、3終端、終端画像、`shutDownPageContainer(1)`を確認するようにした。
- 同じcaseでSimulatorを再起動する復元試験と、添付送信を1回だけ故障させる再試行試験を追加した。
- Simulatorの透明RGBA画像を目視確認できるよう、証跡PNGを黒背景へ合成した。

## 自動評価

```text
npm test
npm run simulator:evidence
npm run loop:check
npm run fitness:release
```

- Simulator 0.8.0: 27/27経路成功、すべて14ノード、3終端到達
- Test: 20件成功
- implementation: 100/100、PASS
- release: 74/100（65から+9）、未達は実機・5人テスト・物語人手評価の3ゲート
- 終端スクリーンショット: 27枚
- 再起動復元: `attachment_portrait`で成功
- 添付失敗再試行: エラー表示、同一ノード保持、再送成功、`mail_portrait`進行を確認
- 入力再送: 0回。期待状態が来ない操作は失敗として扱う
- 構造化レポート: `output/simulator/evidence-report.json`

## 人手確認

- 環境: Chromium phone preview / Even Hub Simulator 0.8.0
- 操作列: 選択列000〜222、添付地点再起動、添付故障→決定再試行、終端→終了
- 観察: 返信カーソルは上下入力に追従し、全経路で欠落なく進行した。3終端、添付エラー、復旧後画像、再起動後画像を黒背景合成PNGで判読できた。
- 証拠: `output/simulator/evidence-report.json`、`output/simulator/*-black.png`、`output/playwright/phone-choice-final.png`
- 未確認: G2/R1実機、ロック状態、2分アイドル、実機の画像失敗、5人ユーザーテスト、物語6項目の人手評価

## 判断

- 採用
- 理由: 同じ最終`dist`で全27経路を2回連続完走し、入力欠落の再現がなくなった。復元と添付故障回復も独立試験と一体試験の両方で再現した。
- 最大の残存リスク: Simulatorと実機の入力差、ロック/アイドル復帰、実際の読者によるHookとEnding Pullの評価
- 次の仮説: G2実機の全27経路とG2+R1の耐久手順を実行すれば、残る技術的release gateを閉じられる。
