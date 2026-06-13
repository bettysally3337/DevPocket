<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

const activeTab = ref('base64')
const tabs = [['base64', 'Base64'], ['uri', 'URI'], ['json', 'JSON'], ['converter', '檔案轉換']]
const text = reactive({ base64Input: '', base64Output: '', uriInput: '', uriOutput: '', jsonInput: '', jsonOutput: '' })
const uriMode = ref('component')
const jsonIndent = ref('2')
const textStatus = reactive({ base64: '', uri: '', json: '' })

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}
function base64ToUtf8(value) {
  const bytes = Uint8Array.from(atob(value.trim()), (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}
function transform(tool, callback) {
  try {
    text[tool + 'Output'] = callback(text[tool + 'Input'])
    textStatus[tool] = '完成'
  } catch (error) { textStatus[tool] = '無法轉換：' + error.message }
}
function runBase64(mode) { transform('base64', mode === 'encode' ? utf8ToBase64 : base64ToUtf8) }
function runUri(mode) {
  const full = uriMode.value === 'full'
  transform('uri', mode === 'encode' ? (full ? encodeURI : encodeURIComponent) : (full ? decodeURI : decodeURIComponent))
}
function runJson(minify = false) {
  transform('json', (value) => JSON.stringify(JSON.parse(value), null, minify ? 0 : (jsonIndent.value === 'tab' ? '\t' : Number(jsonIndent.value))))
}
async function copyText(value, tool) { await navigator.clipboard.writeText(value); textStatus[tool] = '已複製' }
function clearText(tool) { text[tool + 'Input'] = ''; text[tool + 'Output'] = ''; textStatus[tool] = '' }

const catalog = {
  document: [
    { id: 'image-pdf', label: '圖片合併成 PDF', accept: 'image/jpeg,image/png,image/webp', multiple: true, ready: true, note: '將多張圖片依選取順序合併成 A4 PDF。' },
    { id: 'ocr', label: 'OCR 圖片轉文字', accept: 'image/*', ready: true, note: '辨識繁體中文與英文；首次使用會下載語言模型。' },
    { id: 'pdf-docx', label: 'PDF 轉 Word', ready: false, note: '需要後端版面分析引擎，純瀏覽器無法可靠還原 Word 排版。' },
    { id: 'office-pdf', label: 'Word / PPT 轉 PDF', ready: false, note: '需要 Office 或 LibreOffice 排版引擎。' }
  ],
  image: [
    { id: 'heic-jpg', label: 'HEIC 轉 JPG', accept: '.heic,.heif,image/heic,image/heif', ready: true, note: '適合 iPhone 照片，處理全程在瀏覽器內。' },
    { id: 'webp-image', label: 'WebP 轉 PNG / JPG', accept: '.webp,image/webp', ready: true, note: '使用瀏覽器 Canvas 轉換。' },
    { id: 'remove-bg', label: 'AI 圖片去背', accept: 'image/jpeg,image/png,image/webp', ready: true, note: '使用 IMG.LY 模型在裝置上去背；首次使用需下載大型 AI 模型。' }
  ],
  media: [
    { id: 'mov-mp4', label: 'MOV 轉 MP4', accept: '.mov,video/quicktime,video/*', ready: true, note: '使用 FFmpeg WASM。大影片會很慢，建議 200 MB 以下並使用桌機。' },
    { id: 'video-gif', label: '影片轉 GIF', accept: 'video/*', ready: true, note: '可設定開始時間、長度、FPS 與寬度。GIF 通常比原影片更大。' },
    { id: 'youtube', label: 'YouTube 轉 MP3 / MP4', ready: false, note: '本站不提供 YouTube 下載，以避免平台條款與內容授權問題。' }
  ]
}
const category = ref('document')
const operationId = ref('image-pdf')
const operation = computed(() => catalog[category.value].find((item) => item.id === operationId.value))
const files = ref([])
const fileInput = ref(null)
const status = ref('')
const progress = ref(0)
const busy = ref(false)
const dragging = ref(false)
const result = reactive({ url: '', name: '', message: '', text: '', preview: '' })
const outputFormat = ref('png')
const jpegQuality = ref('0.92')
const gif = reactive({ start: 0, duration: 3, fps: 12, width: 480 })
let ffmpegInstance = null

watch(category, () => { operationId.value = catalog[category.value][0].id })
watch(operationId, resetConverter)
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}
function clearResult() {
  if (result.url) URL.revokeObjectURL(result.url)
  Object.assign(result, { url: '', name: '', message: '', text: '', preview: '' })
}
function resetConverter() { files.value = []; if (fileInput.value) fileInput.value.value = ''; status.value = ''; progress.value = 0; clearResult() }
function chooseFiles() { fileInput.value?.click() }
function takeFiles(list) {
  if (!operation.value.ready) return
  files.value = Array.from(list).slice(0, operation.value.multiple ? undefined : 1)
  clearResult(); status.value = ''
}
function onDrop(event) { dragging.value = false; takeFiles(event.dataTransfer.files) }
function imageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob); const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取圖片')) }
    image.src = url
  })
}
function canvasBlob(image, type, quality) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height
  const context = canvas.getContext('2d')
  if (type === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height) }
  context.drawImage(image, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('圖片轉換失敗')), type, quality))
}
function setDownload(blob, name, message, preview = false) {
  clearResult(); result.url = URL.createObjectURL(blob); result.name = name; result.message = message
  result.preview = preview ? result.url : ''; progress.value = 100; status.value = '轉換完成'
}
async function convertWebp(file) {
  const image = await imageFromBlob(file); const mime = outputFormat.value === 'jpeg' ? 'image/jpeg' : 'image/png'
  const blob = await canvasBlob(image, mime, Number(jpegQuality.value))
  setDownload(blob, file.name.replace(/\.webp$/i, '') + (mime === 'image/jpeg' ? '.jpg' : '.png'), '圖片已轉換', true)
}
async function convertHeic(file) {
  status.value = '載入 HEIC 解碼器...'; const { default: heic2any } = await import('heic2any'); progress.value = 30
  const output = await heic2any({ blob: file, toType: 'image/jpeg', quality: Number(jpegQuality.value) })
  const blob = Array.isArray(output) ? output[0] : output
  setDownload(blob, file.name.replace(/\.hei[cf]$/i, '') + '.jpg', 'HEIC 已轉為 JPG', true)
}
async function imagesToPdf(selected) {
  status.value = '建立 PDF...'; const { jsPDF } = await import('jspdf'); let pdf
  for (let index = 0; index < selected.length; index += 1) {
    const image = await imageFromBlob(selected[index]); const landscape = image.width > image.height
    const pageWidth = landscape ? 297 : 210; const pageHeight = landscape ? 210 : 297
    if (!pdf) pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
    else pdf.addPage('a4', landscape ? 'landscape' : 'portrait')
    const scale = Math.min((pageWidth - 20) / image.width, (pageHeight - 20) / image.height)
    const width = image.width * scale; const height = image.height * scale
    const canvas = document.createElement('canvas'); const ratio = Math.min(1, 2200 / Math.max(image.width, image.height))
    canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio)
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    pdf.addImage(canvas.toDataURL('image/jpeg', .88), 'JPEG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height)
    progress.value = Math.round(((index + 1) / selected.length) * 90)
  }
  setDownload(pdf.output('blob'), 'images.pdf', selected.length + ' 張圖片已合併')
}
async function runOcr(file) {
  status.value = '載入 OCR 與繁體中文模型...'; const Tesseract = await import('tesseract.js')
  const response = await Tesseract.recognize(file, 'chi_tra+eng', { logger: (event) => {
    if (event.progress) progress.value = Math.round(event.progress * 100)
    if (event.status) status.value = 'OCR：' + event.status
  } })
  const recognized = response.data.text.trim(); const blob = new Blob([recognized], { type: 'text/plain;charset=utf-8' })
  setDownload(blob, 'ocr-result.txt', 'OCR 辨識完成'); result.text = recognized
}
async function removeImageBackground(file) {
  status.value = '載入 AI 去背模型，首次使用可能需要一段時間...'; progress.value = 2
  const { removeBackground } = await import('@imgly/background-removal')
  const blob = await removeBackground(file, {
    model: 'isnet_quint8', output: { format: 'image/png', quality: 1 },
    progress: (_key, current, total) => { if (total) progress.value = Math.round((current / total) * 90) }
  })
  setDownload(blob, file.name.replace(/\.[^.]+$/, '') + '-no-bg.png', '背景已移除', true)
}
async function loadFfmpeg() {
  if (ffmpegInstance?.loaded) return ffmpegInstance
  status.value = '載入 FFmpeg 引擎（約 30 MB）...'
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  ffmpegInstance = new FFmpeg()
  ffmpegInstance.on('progress', ({ progress: value }) => { progress.value = Math.max(1, Math.min(99, Math.round(value * 100))) })
  const base = import.meta.env.BASE_URL + 'ffmpeg/'
  await ffmpegInstance.load({ coreURL: base + 'ffmpeg-core.js', wasmURL: base + 'ffmpeg-core.wasm' })
  return ffmpegInstance
}
function safeExt(name, fallback) { const match = name.match(/\.([a-z0-9]+)$/i); return match ? match[1].toLowerCase() : fallback }
async function ffmpegConvert(file, mode) {
  if (file.size > 200 * 1024 * 1024) throw new Error('影片超過 200 MB，瀏覽器可能記憶體不足。請先壓縮或改用桌面工具。')
  const [{ fetchFile }, ffmpeg] = await Promise.all([import('@ffmpeg/util'), loadFfmpeg()])
  const input = 'input.' + safeExt(file.name, 'mov'); const output = mode === 'mp4' ? 'output.mp4' : 'output.gif'
  await ffmpeg.writeFile(input, await fetchFile(file)); progress.value = 5; let exitCode
  if (mode === 'mp4') {
    status.value = '嘗試快速封裝成 MP4...'
    exitCode = await ffmpeg.exec(['-i', input, '-map', '0:v:0', '-map', '0:a?', '-c', 'copy', '-movflags', '+faststart', output])
    if (exitCode !== 0) {
      status.value = '原始編碼不相容，改用 H.264 / AAC 轉碼...'
      exitCode = await ffmpeg.exec(['-i', input, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output])
    }
  } else {
    status.value = '正在產生 GIF...'
    const filter = 'fps=' + gif.fps + ',scale=' + gif.width + ':-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse'
    exitCode = await ffmpeg.exec(['-ss', String(gif.start), '-t', String(gif.duration), '-i', input, '-filter_complex', filter, '-loop', '0', output])
  }
  if (exitCode !== 0) throw new Error('FFmpeg 無法轉換此影片，可能是不支援的編碼格式。')
  const data = await ffmpeg.readFile(output); const mime = mode === 'mp4' ? 'video/mp4' : 'image/gif'
  await Promise.allSettled([ffmpeg.deleteFile(input), ffmpeg.deleteFile(output)])
  setDownload(new Blob([data.buffer], { type: mime }), file.name.replace(/\.[^.]+$/, '') + (mode === 'mp4' ? '.mp4' : '.gif'), mode === 'mp4' ? '影片已轉為 MP4' : 'GIF 已產生', true)
}
async function runConversion() {
  if (!operation.value.ready || busy.value) return
  if (!files.value.length) { status.value = '請先選擇檔案'; return }
  busy.value = true; clearResult(); progress.value = 1; status.value = '準備轉換...'
  try {
    const id = operation.value.id; const file = files.value[0]
    if (id === 'image-pdf') await imagesToPdf(files.value)
    else if (id === 'ocr') await runOcr(file)
    else if (id === 'heic-jpg') await convertHeic(file)
    else if (id === 'webp-image') await convertWebp(file)
    else if (id === 'remove-bg') await removeImageBackground(file)
    else if (id === 'mov-mp4') await ffmpegConvert(file, 'mp4')
    else if (id === 'video-gif') await ffmpegConvert(file, 'gif')
  } catch (error) { status.value = '轉換失敗：' + error.message; progress.value = 0 }
  finally { busy.value = false }
}
onBeforeUnmount(() => { clearResult(); ffmpegInstance?.terminate() })
</script>

<template>
  <header class="hero"><div class="hero__inner"><p class="eyebrow">DEVPOCKET</p><h1>Everyday tools,<br>right in your browser.</h1><p class="hero__copy">文字、文件、圖片與影片轉換。可行的工作都直接在你的裝置上完成。</p></div></header>
  <main class="shell">
    <nav class="tabs" aria-label="工具選擇"><button v-for="tab in tabs" :key="tab[0]" class="tab" :class="{ 'is-active': activeTab === tab[0] }" @click="activeTab = tab[0]">{{ tab[1] }}</button></nav>

    <section v-if="activeTab === 'base64'" class="tool">
      <div class="tool__heading"><div><p class="tool__number">01</p><h2>Base64 converter</h2></div><p>支援 UTF-8 中文與特殊字元</p></div>
      <div class="workspace"><label class="field"><span>INPUT</span><textarea v-model="text.base64Input" placeholder="輸入要編碼或解碼的文字..."></textarea></label><div class="actions actions--vertical"><button @click="runBase64('encode')">Encode →</button><button @click="runBase64('decode')">Decode →</button></div><label class="field"><span>OUTPUT</span><textarea :value="text.base64Output" readonly></textarea></label></div>
      <div class="utility"><button @click="copyText(text.base64Output, 'base64')">Copy output</button><button @click="clearText('base64')">Clear</button></div><p class="status">{{ textStatus.base64 }}</p>
    </section>

    <section v-if="activeTab === 'uri'" class="tool">
      <div class="tool__heading"><div><p class="tool__number">02</p><h2>URI converter</h2></div><label class="select-label">模式<select v-model="uriMode"><option value="component">URI component (encodeURIComponent)</option><option value="full">Full URI / URL (encodeURI)</option></select></label></div>
      <div class="workspace"><label class="field"><span>INPUT</span><textarea v-model="text.uriInput" placeholder="輸入 URI 或文字..."></textarea></label><div class="actions actions--vertical"><button @click="runUri('encode')">Encode →</button><button @click="runUri('decode')">Decode →</button></div><label class="field"><span>OUTPUT</span><textarea :value="text.uriOutput" readonly></textarea></label></div>
      <div class="utility"><button @click="copyText(text.uriOutput, 'uri')">Copy output</button><button @click="clearText('uri')">Clear</button></div><p class="status">{{ textStatus.uri }}</p>
    </section>

    <section v-if="activeTab === 'json'" class="tool">
      <div class="tool__heading"><div><p class="tool__number">03</p><h2>JSON formatter</h2></div><label class="select-label">縮排<select v-model="jsonIndent"><option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tab</option></select></label></div>
      <div class="workspace"><label class="field"><span>INPUT</span><textarea v-model="text.jsonInput" placeholder='貼上 JSON，例如 {"hello":"world"}'></textarea></label><div class="actions actions--vertical"><button @click="runJson(false)">Format →</button><button @click="runJson(true)">Minify →</button></div><label class="field"><span>OUTPUT</span><textarea :value="text.jsonOutput" readonly></textarea></label></div>
      <div class="utility"><button @click="copyText(text.jsonOutput, 'json')">Copy output</button><button @click="clearText('json')">Clear</button></div><p class="status">{{ textStatus.json }}</p>
    </section>

    <section v-if="activeTab === 'converter'" class="tool converter">
      <div class="tool__heading"><div><p class="tool__number">04</p><h2>File converter</h2></div><p>先選類別，再選轉換功能</p></div>
      <div class="converter__selectors">
        <label class="picker"><span>類別</span><select v-model="category"><option value="document">文件類</option><option value="image">圖片類</option><option value="media">影音類</option></select></label>
        <label class="picker"><span>轉換成</span><select v-model="operationId"><option v-for="item in catalog[category]" :key="item.id" :value="item.id">{{ item.label }}{{ item.ready ? '' : '（需要後端）' }}</option></select></label>
      </div>
      <div class="converter__notice" :class="{ 'is-limited': !operation.ready }"><strong>{{ operation.label }}</strong><br>{{ operation.note }}</div>
      <div class="drop-zone" :class="{ 'is-dragging': dragging, 'is-disabled': !operation.ready }" @dragenter.prevent="dragging = true" @dragover.prevent @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
        <input ref="fileInput" type="file" hidden :accept="operation.accept" :multiple="operation.multiple" @change="takeFiles($event.target.files)">
        <p class="drop-zone__title">拖曳檔案到這裡</p><p class="drop-zone__meta">{{ operation.ready ? (operation.multiple ? '可選擇多個檔案' : '或選擇一個檔案') : '目前無法在純前端可靠執行' }}</p><button class="secondary-button" :disabled="!operation.ready" @click="chooseFiles">選擇檔案</button>
      </div>
      <div class="file-list"><div v-for="file in files" :key="file.name + file.size" class="file-chip"><strong>{{ file.name }}</strong><span>{{ formatBytes(file.size) }}</span></div></div>
      <div class="converter__options">
        <label v-if="operationId === 'webp-image'" class="picker"><span>輸出格式</span><select v-model="outputFormat"><option value="png">PNG</option><option value="jpeg">JPG</option></select></label>
        <label v-if="['webp-image', 'heic-jpg'].includes(operationId)" class="picker"><span>JPG 品質</span><select v-model="jpegQuality"><option value="0.92">高品質</option><option value="0.82">標準</option><option value="0.7">較小檔案</option></select></label>
        <template v-if="operationId === 'video-gif'"><label class="picker"><span>開始秒數</span><input v-model.number="gif.start" type="number" min="0" step="0.1"></label><label class="picker"><span>長度（秒）</span><input v-model.number="gif.duration" type="number" min="0.5" max="20" step="0.5"></label><label class="picker"><span>FPS</span><input v-model.number="gif.fps" type="number" min="5" max="24"></label><label class="picker"><span>寬度（px）</span><input v-model.number="gif.width" type="number" min="160" max="960" step="40"></label></template>
      </div>
      <div class="converter__actions"><button class="primary-button" :disabled="!operation.ready || busy" @click="runConversion">{{ busy ? '轉換中...' : (operation.ready ? '開始轉換' : '此功能需要後端') }}</button><button class="secondary-button" :disabled="busy" @click="resetConverter">清除</button></div>
      <div v-if="progress > 0" class="progress"><div :style="{ width: progress + '%' }"></div></div><p class="status converter__status">{{ status }}</p>
      <div v-if="result.url || result.text" class="converter__result"><textarea v-if="result.text" v-model="result.text" aria-label="OCR 結果"></textarea><img v-if="result.preview && operationId !== 'mov-mp4'" class="result-preview" :src="result.preview" alt="轉換結果預覽"><video v-if="result.preview && operationId === 'mov-mp4'" class="result-preview" :src="result.preview" controls></video><div class="result-card"><p>{{ result.message }}</p><a class="download-button" :href="result.url" :download="result.name">下載 {{ result.name }}</a></div></div>
    </section>
  </main>
  <footer><span>DevPocket</span><span>Files stay on your device. Models and engines load only when needed.</span></footer>
</template>
