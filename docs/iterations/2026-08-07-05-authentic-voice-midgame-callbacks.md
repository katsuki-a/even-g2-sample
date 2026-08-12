# Iteration 2026-08-07-05

## 仮説

最初の2選択を死亡記録直後の9種類の本人メモとして呼び戻し、偽送信者の反転でミナの言葉を消さず「メールという接続だけが偽造」と限定すれば、選択の手応えと人物固有の声を同時に強められる。弱い結末を新しい怪異の追加から既存証拠による本人意図の解明へ変えれば、ending pullとcliche resistanceも改善できる。

## 対象

- 種別: story / engine
- 適応度項目: momentum、choice tension、voice specificity、reveal payoff、ending pull、cliche resistance
- 変更前スコア: Narrative 77/100（面白さ74.8、非凡庸性79.4、最低経路72.5）

## 変更

- mail / attachment / systemの通常ノードにもflag条件遷移を許可した。
- 2つの既選択を9種類の`mail_record_*`へ写像し、27経路の各13ノード目で本人筆跡の固有メモとして再提示した。
- 偽送信者の開示を「ミナは一通も書いていない」から「言葉は全部ミナだが、メールとして接続したのはM-17」へ変更した。
- システム表示から解読負荷の高い割合値を外し、17層・27経路・観測者28の三情報へ絞った。
- `reject_dark-keep_unknown`、`reject_dark-lend_view`、`name_exit-lend_view`、`name_dark-keep_unknown`を、新しい第三者・内側の怪異・自律装置の追加ではなく、17本のダッシュ、返却記録、裏面メモ、逆向き保管の回収へ変更した。

## 自動評価

```text
node --no-warnings --experimental-transform-types --test src/domain/engine.test.ts harness/narrative.test.mjs harness/fitness.test.mjs
npm run build
npm run simulator:evidence
```

- 結果: 変更対象テスト30件成功。独立5人格の再評価後はconcept統合テストも成功。strict TypeScriptとVite build成功
- Story: 84ノード、27経路、27終端、全経路20ノード。件名24字・本文160字の上限違反なし
- Simulator: 27/27固有経路、再起動復元、添付失敗からの再試行に成功
- 証拠: `output/simulator/evidence-report.json`
- ハードゲート: なし
- 変更後スコア: Narrative 78/100（面白さ75.4、非凡庸性81.3、最低経路77.5）

## Narrative Persona Review

- input digest: 人格別の新digestで検証済み
- 人格数 / 経路数: 5 / 27
- 面白さ / 非凡庸性 / 総合: 75.4 / 81.3 / 78
- 最低経路: `choice_year=ask_mina--choice_safety=avoid_back_door--choice_final=draft_only`（77.5）
- 頻出するありがちな類型: なし
- 3人格以上が検出した強制テスト: なし。全6テスト0/5
- 評価不一致: G2統合は全体中央値5。他9軸は4

## 人手確認

- 環境: Even Hub Simulator 0.8.0
- 操作列: `000`〜`222`、各経路20ノード、添付地点再起動、添付故障→再受信
- 観察: 9種類の条件付き本人メモから27種類の固有ENDへ全経路が到達した。改稿した最低経路`212`も`mail_record_name_exit`を経て`ending_name_exit_lend_view`へ到達した。
- 証拠: `output/simulator/evidence-report.json`

## 判断

- 採用 / 破棄: 採用
- 理由: Narrative 77→78、最低経路72.5→77.5。人物交換テストも0/5になり、選択コールバックは全人格に認識された。
- 最大の残存リスク: 9通の本人メモだけでは共通中盤の反復を解消しきれず、人物の感情より機構説明が前へ出る。
- 次の仮説: 三日後メールと証拠画像も選択組合せ別に分け、唐突な怪異終端を事故後の改ざん物証へ置き換える。
