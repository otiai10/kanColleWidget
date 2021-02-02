import Tesseract, {createWorker} from "tesseract.js";

export default class OCRService {
  constructor(
    private url: string = "https://api-kcwidget.herokuapp.com/ocr/base64"
  ) {
    this.worker = createWorker({
      errorHandler: console.error,
      workerBlobURL: false,
      workerPath: chrome.runtime.getURL("dest/js/tsworker.js"),
    });
  }
  private readonly worker: Tesseract.Worker

  /**
   * Base64形式のimageを受けて、OCRのうえ、ミリ秒に変換して返す
   * @param {string} base64 Base64形式の画像データ（data:image/jpeg;base64,xxxxx....)
   * @returns {string} text OCR結果
   * @returns {number} time ミリ秒
   */
  async fromBase64(base64: string): Promise<{ text: string; time: number }> {
    const text = await this.base64toText(base64);
    return { text, time: this.textToMillisecond(text) };
  }

  async base64toText(base64: string): Promise<string> {
    console.log(["tes"])
    const res = await this.worker.recognize(base64);
    console.log(["res", res])
    return res.data.text.trim();
  }

  textToMillisecond(text: string): number {
    const [h, m, s] = text.trim().split(":").map(p => parseInt(p, 10));
    return (h * (60 * 60) + m * (60) + s) * 1000;
  }
}