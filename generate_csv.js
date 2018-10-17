(function() {
    "use strict";
    kintone.events.on('app.record.index.show', function(event) {
        if (document.getElementById('download_button') !== null) {
            return;
        }
        if (event.viewName !== '出力用一覧（当月&出力済除外）') {
            return;
        }

        var ouputCsvButton = document.createElement('button');
        ouputCsvButton.id = 'download_button';
        ouputCsvButton.innerHTML = 'CSV出力';

        // ボタンクリック時の処理
        ouputCsvButton.onclick = function() {
            downloadAndUpdate();
        };

        kintone.app.getHeaderMenuSpaceElement().appendChild(ouputCsvButton);
        return event;

        // ダウンロードと出力済み更新
        function downloadAndUpdate() {
            // CSV作成対象レコードの総件数を取得
            let param = {
                app: event.appId,
                query: 'counsellors_check in ("済") and advance_date = LAST_MONTH() and output_flag not in ("済") limit 1',
                fields: ['counsellors_check'],
                totalCount: true,
                isGuest: false
            };
            kintoneUtility.rest.getRecords(param)
            .then(function(resp) {
                if(resp.totalCount > 0) {
                    // 処理対象が１件以上存在する場合は、ファイル出力と出力済みフラグの更新を行う
                    let param = {
                        app: event.appId,
                        query: 'counsellors_check in ("済") and advance_date = LAST_MONTH() and output_flag not in ("済")',
                        fields: ['$id', 'counsellors_check', 'kind_of_tax', 'output_flag', 'payment_due_date', 'applicant', 'expense', 'advance_date', 'details_to_apply', 'amount_of_money'],
                        totalCount: false,
                        isGuest: false
                    };
                    kintoneUtility.rest.getAllRecordsByQuery(param)
                    .then(function(resp){
                        // 出力処理
                        let records = resp.records;
                        let csv = [];
                        let row = ['税金', '支払い予定日', '氏名', '費目', '日付', '内容', '金額'];
                        csv.push(row);

                        // エスケープ
                        let escapeStr = function(value) {
                            return '"' + (value? value.replace(/"/g, '""'): '') + '"';
                        };

                        for (let rec of records) {
                            // 出力内容をレコードから取得
                            row = [];
                            row.push(escapeStr(rec['kind_of_tax'].value));
                            row.push(escapeStr(rec['payment_due_date'].value));
                            row.push(escapeStr(rec['applicant'].value));
                            row.push(escapeStr(rec['expense'].value));
                            row.push(escapeStr(rec['advance_date'].value));
                            row.push(escapeStr(rec['details_to_apply'].value));
                            row.push(escapeStr(rec['amount_of_money'].value));
                            csv.push(row);
                        }
                        downloadFile(csv);

                        // 更新データ準備
                        let newRecords = records.map(function(record) {
                            let newRec = {
                                id: record['$id'].value,
                                record: {}
                            }
                            newRec.record['output_flag'] = {value: ['済']}
                  
                            return newRec;
                        });

                        // 更新処理
                        let param = {
                            app: event.appId,
                            records: newRecords,
                            isGuest: false
                        };
                        kintoneUtility.rest.putAllRecords(param);
                        location.reload();
                    });
                }
                else {
                    alert('処理対象レコードがありません');
                }
            }).catch(function(error) {
                // エラー時の処理
                alert('レコード取得エラー:' + error.message);
            });
        }

        // ダウンロード処理
        function  downloadFile(csv) {
            let fileName = 'paymentList.csv';

            // Blob準備
            let str2array = function(str) {
                let array = [], i;
                for (i=0; i<str.length; i++) array.push(str.charCodeAt(i));
                return array;
            };
            // SJISの配列に変換
            let csvbuf = csv.map(function(e) {
                return e.join(',')
            }).join('\r\n');

            let array = str2array(csvbuf);
            let sjis_array = Encoding.convert(array, "SJIS", "UNICODE");
            let uint8_array = new Uint8Array(sjis_array);

            let blob = new Blob([uint8_array], {type: 'text/csv'});

            if(window.navigator.msSaveBlob) {
                window.navigator.msSaveBlob(blob, fileName);
            } else {
                let url = (window.URL || window.webkitURL);
                let blobUrl = url.createObjectURL(blob);
                let e = document.createEvent('MouseEvents');
                e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                let a = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
                a.href = blobUrl;
                a.download = fileName;
                a.dispatchEvent(e);
            }
        }
    }); 
})();

function createUnpayedList(inSheetName) {
  var inSheetName = "経費一覧";
  var outSheetName = "未払計上仕訳_" + Utilities.formatDate(new Date(), "JST", "yyyyMMdd");
  
  var accountCodes = {
    "広告宣伝費":"6113",
    "新聞図書費":"6114",
    "発送配達費":"6115",
    "旅費交通費":"6133",
    "諸会費":"6134",
    "事務用消耗品費":"6217",
    "電話等通信費":"6218",
    "租税公課":"6221",
    "備品・消耗品費":"6225",
    "交通費":"6133",
    "雑費":"5467",
    "地代家賃":"6215",
    "水道光熱費":"6219",
    "機械・装置":"1213",
    "会議費":"6111",
    "交際費":"6223",
    "交際費(5000円以下)":"6112",
    "支払手数料":"6232",
    "厚生費":"6226",
    "外注費":"6212",
    "ｺﾐｯｼｮﾝ料":"5214",
    "SaaS代":"6331",
    "郵便代":"6332",
    "工具・器具・備品":"1216",
    "ﾘｰｽ料":"6334",
    "預り金":"2117",
    "支払報酬":"6235",
    "研修費":"6660",
    "仮払金":"1156",
    "雑収入":"7118",
    "保険料":"6224",
    "立替金":"1155",
    "(10万以上) 工具・器具":"1216",
    "イベント費":"6115",
  };
  var genka = {
    "外注費":"6212",
    "広告宣伝費":"6113",
    "ｺﾐｯｼｮﾝ料":"5214",
    "SaaS代":"6331",
    "仕入外注費":"6332"
  };
  var deposits = {
    "預り金":"2117",
    "仮払金":"1156"
  };
  var payers = {
    "倉貫":"1",
    "藤原":"2",
    "小口現金":"",
    "":""
  }
  
  // create new sheet
  var outSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(outSheetName);
  var inSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(inSheetName);
  var date = new Date();
  date.setMonth(date.getMonth()-1);
  var targetMonth = Utilities.formatDate(date, "GMT+9", "M"); //対象月は前月のみ

  
  var inRow = 2;
  var outRow = 1;
  while (inSheet.getRange("A" + inRow).getValue() != "" ) {
    var rIn = inSheet.getRange("A" + inRow + ":" + "J" + inRow);
    var rowDate = inSheet.getRange("E" + inRow).getValue();
    var rowMonth = Utilities.formatDate(new Date(rowDate), "GMT+9", "M");
    Logger.log(rowDate);
    Logger.log(rowMonth);
    if (inSheet.getRange("J" + inRow).getValue() == "") {
    //if (inSheet.getRange("J" + inRow).getValue() == "" && targetMonth == rowMonth) { // https://www.remotty.net/groups/263/entries/157461
      var rOut = outSheet.getRange("A" + outRow + ":" + "AC" + outRow);
      var payer = trimString(rIn.getCell(1, 6).getValue());
      
      // 預金（立替ではない）場合は出力しない
      if( (deposits[rIn.getCell(1, 1).getValue()] != undefined) || ( payer == "-") || (payer == "") ){
        // 計上済のしるし
        rIn.getCell(1, 10).setValue("＊");
      } else {
        // 1 処理区分
        rOut.getCell(1, 1).setValue("1");
        // 2 データID
        // 3 伝票日付
        rOut.getCell(1, 3).setValue(rIn.getCell(1, 5).getValue());
        // 4 伝票番号
        // 5 入力日付
        //--------------------------借方
        // 6 借方・科目
        rOut.getCell(1, 6).setValue(accountCodes[rIn.getCell(1, 1).getValue()]);
        // 7 補助コード
        if(rIn.getCell(1, 1).getValue() == "外注費") {
          rOut.getCell(1, 7).setValue(13); 
        }
        // 8 部門コード
        // 9 取引先コード
        // 10 取引先名
        // 11 税種別
        if(genka[rIn.getCell(1, 1).getValue()] == undefined) {
          // 原価ではない経費は60
          rOut.getCell(1, 11).setValue(60);  
        } else {
          // 原価は50
          rOut.getCell(1, 11).setValue(50);  
        }
        // 12 事業区分
        rOut.getCell(1, 12).setValue(1);
        // 13 税率
        rOut.getCell(1, 13).setValue(8); // 税率8%
        // 14 内外別記
        rOut.getCell(1, 14).setValue(1); // 内税表記は1
        // 15 金額
        rOut.getCell(1, 15).setValue(rIn.getCell(1, 3).getValue());
        // 16 税額
        // 17 摘要
        rOut.getCell(1, 17).setValue(rIn.getCell(1, 4).getValue() + ":" + rIn.getCell(1, 2).getValue());
        //--------------------------貸方
        // 18 貸方・科目（小口現金の場合は1118）
        if (rIn.getCell(1, 6).getValue() == "小口現金"){ 
          rOut.getCell(1, 18).setValue("1118");
        } else {
          rOut.getCell(1, 18).setValue("2114");
        }
        // 19 補助コード
        var payer_code = payers[payer];
        if ( payer_code == undefined ) {
          payer_code = "";
        }
        rOut.getCell(1, 19).setValue(payer_code);
        // 20 部門コード
        // 21 取引先コード
        // 22 取引先名
        // 23 税種別
        if(genka[rIn.getCell(1, 1).getValue()] == undefined) {
          // 原価ではない経費は60
          rOut.getCell(1, 23).setValue(60);  
        } else {
          // 原価は50
          rOut.getCell(1, 23).setValue(50);  
        }
        // 24 事業区分
        rOut.getCell(1, 24).setValue(1);
        // 25 税率
        rOut.getCell(1, 25).setValue(8); // 税率8%
        // 26 内外別記
        rOut.getCell(1, 26).setValue(1); // 内税表記は1
        // 27 金額
        rOut.getCell(1, 27).setValue(rOut.getCell(1, 15).getValue());
        // 28 税額
        // 29 摘要
        rOut.getCell(1, 29).setValue(rOut.getCell(1, 17).getValue());
        
        // 計上済のしるし
        var d = Utilities.formatDate( new Date(), 'JST', 'M/d');
        rIn.getCell(1, 10).setValue(d);

        outRow++;
      }
    }
    inRow++;
  }
}


function trimString(src){
  if (src == null || src == undefined){
    return "";
  }
  return src.replace(/(^\s+)|(\s+$)/g, "");
}