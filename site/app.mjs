import { returns, windowRows } from './metrics.mjs';

const app = document.querySelector('#app');
const states = {
  unavailable:'净值来源待核', snapshot:'官方快照', updated:'已收录新估值',
  unchanged:'官方尚无新估值', older:'来源滞后 · 保留已存净值', error:'检查失败 · 保留已存净值',
};
const labels = ['日涨跌', '本周以来', '本月以来'];
const fmt = value => value == null ? '不可计算' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

function add(parent, tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function link(parent, text, href) {
  const node = add(parent, 'a', text);
  node.href = href;
  if (href.startsWith('https://')) {
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  return node;
}

function quote(parent, p) {
  const current = p.history.at(-1);
  add(parent, 'span', states[p.state], 'status');
  const line = add(parent, 'p', current?.nav ?? '暂无净值', 'quote');
  if (current) add(line, 'small', p.currency);
  add(parent, 'div', `估值日 ${current?.date ?? '待核实'}`, 'meta');
  const metrics = add(parent, 'dl');
  returns(p.history).forEach((value, i) => {
    const item = add(metrics, 'div');
    add(item, 'dt', labels[i]);
    add(item, 'dd', fmt(value), value > 0 ? 'positive' : value < 0 ? 'negative' : '');
  });
  if (p.distributing) add(parent, 'small', '以上为净值价格变化 · 含分红总回报不可计算');
  if (current) link(parent, '官方净值来源', current.source);
  if (p.source && p.source !== current?.source) link(parent, '官方产品资料', p.source);
  if (!p.source && !current) add(parent, 'small', '暂无可核实的官方产品链接');
}

function plot(canvas, rows) {
  const {width, height} = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  const values = rows.map(row => Number(row.nav));
  const times = rows.map(row => Date.parse(row.date));
  const low = values.reduce((a,b) => Math.min(a,b));
  const high = values.reduce((a,b) => Math.max(a,b));
  const left = 51, right = width - 15, top = 20, bottom = height - 37;
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#47625b';
  for (const fraction of [0, .5, 1]) {
    if (low === high && fraction !== .5) continue;
    const y = bottom - fraction * (bottom - top);
    ctx.fillText(Number((low + (high - low) * fraction).toPrecision(5)).toString(), 0, y + 4);
    ctx.strokeStyle = '#d5e0d8';
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }
  const points = values.map((v,i) => [
    rows.length === 1 ? (left + right)/2 : left + (right-left)*(times[i]-times[0])/(times.at(-1)-times[0]),
    low === high ? (top+bottom)/2 : bottom - (bottom-top)*(v-low)/(high-low),
  ]);
  ctx.strokeStyle = '#006955';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.stroke();
  for (const [x,y] of points) {
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
  }
  ctx.fillText(rows[0].date, left, height-10);
  if (rows.length > 1) {
    ctx.textAlign = 'right';
    ctx.fillText(rows.at(-1).date, right, height-10);
  }
}

let observer;
function detail(p) {
  link(app, '返回产品列表', '#');
  add(app, 'h1', p.name);
  add(app, 'p', [p.bank,p.code,p.share].filter(Boolean).join(' · '), 'meta');
  const panel = add(app,'section',null,'card');
  quote(panel,p);
  add(panel,'p', `${p.verification} · ${p.note}`, 'meta');
  if (p.checkedAt) add(panel,'small', '最近检查 ' + new Intl.DateTimeFormat('zh-CN', {
    timeZone:'Asia/Shanghai', dateStyle:'medium', timeStyle:'short',
  }).format(new Date(p.checkedAt)) + '（北京时间）');
  add(app,'h2','历史单位净值');
  const history = add(app,'section',null,'panel');
  const controls = add(history,'div',null,'controls');
  const content = add(history,'div');
  function show(range) {
    observer?.disconnect();
    content.replaceChildren();
    for (const btn of controls.children) btn.setAttribute('aria-pressed', String(btn.dataset.range === range));
    const rows = windowRows(p.history,range);
    if (!rows.length) {
      add(content,'p','该区间暂无已核实估值。');
      return;
    }
    add(content,'p',`${rows.length} 条已核实估值 · 区间以最新估值日为终点`,'meta');
    const canvas = add(content,'canvas');
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','历史单位净值走势图，逐条记录见下方');
    plot(canvas,rows);
    observer = new ResizeObserver(() => plot(canvas,rows));
    observer.observe(canvas);
    const details = add(content,'details');
    add(details,'summary','展开净值记录');
    const list = add(details,'ul');
    for (const row of [...rows].reverse()) {
      const item = add(list,'li',`${row.date} · ${row.nav} ${p.currency} · `);
      link(item,'官方来源',row.source);
    }
  }
  for (const [range,title] of [['30','30天'],['90','90天'],['180','180天'],['year','1年'],['all','全部']]) {
    const btn = add(controls,'button',title);
    btn.dataset.range = range;
    btn.onclick = () => show(range);
  }
  show('30');
}

try {
  const response = await fetch('./data.json', {cache:'no-cache'});
  if (!response.ok) throw new Error('读取失败');
  const products = await response.json();
  function render() {
    observer?.disconnect();
    app.replaceChildren();
    const product = products.find(p => '#' + p.id === location.hash);
    if (product) detail(product);
    else {
      for (const bank of ['汇丰中国','工商银行']) {
        const group = add(app,'section');
        add(group,'h2',bank);
        const grid = add(group,'div',null,'grid');
        for (const p of products.filter(p => p.bank === bank)) {
          const card = add(grid,'article',null,'card');
          link(add(card,'h3'),p.name,'#'+p.id);
          add(card,'div',[p.code,p.share].filter(Boolean).join(' · '),'meta');
          quote(card,p);
        }
      }
    }
  }
  window.addEventListener('hashchange',() => { render(); window.scrollTo(0,0); });
  render();
} catch {
  app.textContent = '读取净值记录失败，请刷新页面。';
}
