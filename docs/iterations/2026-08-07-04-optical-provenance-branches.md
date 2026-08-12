# Iteration 2026-08-07-04

## 仮説

最初の2選択を27個の固有終端まで残し、ミナの職業語彙とG2透明表示を事故記録の因果へ組み込めば、旧稿で全人格が検出したchoice-erasure、character-swap、device-swapを同時に解消し、Narrative Persona評価を大幅に改善できる。

## 対象

- 種別: story / engine
- 適応度項目: choice tension、voice specificity、device integration、ending pull、cliche resistance
- 変更前スコア: Narrative 52/100（面白さ58.3、非凡庸性46.1、最低経路45）

## 変更

- `StoryChoice.next`へ、選択済みflagで解決する条件遷移を追加した。
- 3×3×3の全選択列を27種類のending IDへ一対一に写像した。
- 最終方針を「空白保持」「本人の17文字だけ」「視界を出典化」の記録倫理へ置き換えた。
- M-17を一般的な人格模倣AIから、17台の欠損液晶とG2の透明表示を重ねる光学復元系へ変更した。
- ミナの声へ端末の傷、棚番号、在庫用語、`0`と`—`の区別を反復して入れた。
- Built-in ImageGenで既存添付を参照し、17層と存在しない階段、17番札と液晶傷、読者マスクが実画像にも残る3枚の`OPT_*.BMP`を追加した。既存画像は上書きしていない。
- `harness/narrative.mjs`の選択持続判定を、静的な合流ではなく選択肢ごとの到達ending集合の非交差で測るよう変更した。

## 自動評価

```text
node --no-warnings --experimental-transform-types --test src/*/*.test.ts harness/narrative.test.mjs
npm run build
npm run simulator:evidence
```

- 結果: Narrative/Domain等の変更対象テスト39件成功、strict TypeScriptとVite build成功、Simulator全27/27経路成功。独立5人格の再評価後はconceptゲートも成功
- Story: 100/100、76ノード、27経路、27終端、全経路20ノード
- Narrative mechanics: 選択持続3/3、即時固有反応3/3
- Simulator 0.8.0: 27固有END、END保持、戻る終了、再起動復元、添付失敗→再試行を確認
- 画像更新後の代表経路`221`: 新しい4添付を送信し`ending_name_dark_draft_only`へ完走
- ハードゲート: なし
- 変更後スコア: Narrative 77/100（面白さ74.8、非凡庸性79.4、最低経路72.5）

## Narrative Persona Review

- input digest: `sha256:7f30c1f71dddc0e769c3861b3854d7059bceb34c1ad31535d9d1e9b13110a9c1`を含む人格別digest
- 人格数 / 経路数: 5 / 27
- 面白さ / 非凡庸性 / 総合: 74.8 / 79.4 / 77
- 最低経路: `choice_year=ask_mina--choice_safety=call_emergency--choice_final=lend_view`（72.5）
- 頻出類型: creepy-technology（2人格・2経路）
- 強制テスト合議: 3人格以上の検出なし。character-swapだけ1/5が検出
- 旧稿で3人格以上が検出した強制テスト: choice-erasure 5/5、character-swap 5/5、device-swap 5/5、ending-paraphrase 4/5
- 構造上の改善: 27 ending、人物固有の在庫規則、透明レンズ上の光学合成、3選択すべての終端回収

## 人手確認

- 環境: Even Hub Simulator 0.8.0
- 操作列: `000`〜`222`、各経路20ノード、END決定保持、戻る終了、添付地点再起動、添付故障→再受信
- 観察: 27選択列はすべて異なるending IDへ到達した。4添付は各経路で完了し、コンソールエラーはなかった。`attachment_portrait`からの復元と、計画的な添付失敗後の決定再試行も成功した。
- 証拠: `output/simulator/evidence-report.json`

## 判断

- 採用 / 破棄: 採用
- 理由: Narrativeは52から77へ改善し、旧稿で合議検出された6強制テストをすべて解消した。StoryとSimulatorにも回帰がない。
- 最大の残存リスク: 共通中盤が長く初期2選択の手応えが終端まで薄いこと、本人の声を一度否定する反転、既存の謎を解かず新しい出典を足す弱い終端。
- 次の仮説: 初期2選択を中盤の本人メモへ再登場させ、偽造対象を本人の言葉でなく接続へ限定すれば、choice tension、voice specificity、ending pullを同時に上げられる。
