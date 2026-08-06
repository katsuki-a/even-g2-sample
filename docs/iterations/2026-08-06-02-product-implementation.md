# Iteration 2026-08-06-02

## 仮説

物語遷移を純粋な状態機械へ分離し、SDK、保存、時刻、画像をPortとして接続すれば、Hardware Labを第1話の完成した製品フローへ置き換えながら全経路を自動検証できる。

## 対象

- 種別: engine / renderer / input / resilience / polish
- 適応度項目: Architecture、Story、Simulator evidence
- 変更前スコア: implementation 45/100、Architecture 0/100

## 変更

- 24ノードの正本を読み込む純粋Story Engine、進行状態、テンプレート展開、G2用View Modelを実装した。
- `src/main.ts`を90行台の依存組み立てへ縮小し、controller、Even input/renderer、画像キュー、Clock、Storageを分離した。
- Hardware Lab UIを電話側の製品プレビューへ置き換え、G2未接続でも同じ物語を操作可能にした。
- Even App保存とブラウザbackupを併用し、WebView/Simulator再起動時に確定ノードと添付画像を復元するようにした。
- 200×100・1-bitの`PIC_0047.BMP`を作成し、画像送信を直列化して失敗時の決定入力による再試行を実装した。
- 未使用のマイク、位置、アルバム、カメラ権限をすべて削除した。
- SimulatorでeventType 0やリストindexが欠損するpayloadをinput adapterで補正した。

## 自動評価

```text
npm test
npm run loop:check
npm run fitness:release
```

- Test: 16件成功（全27経路、3終端、決定性、復元、入力正規化、画像直列化、添付再試行）
- implementation: 100/100、PASS
- Story / Docs / Architecture: 100/100
- `src/main.ts`: 100行未満
- 添付: 200×100×1-bit BMP、warning 0
- Package: `no-service.ehpk`を生成可能

## 人手確認

- 環境: Chromium phone preview / Even Hub Simulator 0.8.0
- 操作列: フック→3回の選択→添付→3終端、途中再読み込み、Simulator再起動、最初から、終了
- 観察: 電話側は1経路を完走し、全返信候補の上下選択、添付、終端、復元、初期化を確認した。Simulatorでは添付送信、再起動復元、接続保存ending、`shutDownPageContainer(1)`を最終実装で確認した。
- 証拠: `output/playwright/phone-*.png`、`output/playwright/g2-*-black.png`
- 未確認: Simulator 0.8.0が一部のdown/click payloadからeventTypeまたはindexを落とすため、最終実装での3終端連続確認と画像失敗注入は未完了。G2/R1実機も未確認。

## 判断

- 採用
- 理由: implementation適応度が45から100へ上がり、全ハードゲートと自動検証を通過した。権限と依存境界も要件どおりになった。
- 最大の残存リスク: 実機G2/R1の入力payload、ロック/2分アイドル復帰、画像失敗復旧、5人ユーザーテスト。
- 次の仮説: 実機でSimulator欠損payloadとの差を記録し、入力adapterだけを調整すればrelease evidenceを埋められる。
