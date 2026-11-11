"use strict";

function scoreAtThreshold(value, thresholds, lowerIsBetter = false) {
  const match = thresholds.find(([, threshold]) =>
    lowerIsBetter ? value <= threshold : value >= threshold
  );
  return match?.[0] ?? 0;
}

function calculateBmi(height, weight) {
  return Math.round(weight * 100000 / (height * height)) / 10;
}

function scoreBmi(bmi, sex) {
  if (bmi >= 28) return [60, "肥胖"];
  if (bmi >= 24) return [80, "超重"];
  if (bmi >= (sex === "male" ? 17.9 : 17.2)) return [100, "正常"];
  return [80, "低体重"];
}

function gradeFor(total) {
  if (total >= 90) return ["excellent", "优秀"];
  if (total >= 80) return ["good", "良好"];
  if (total >= 60) return ["pass", "及格"];
  return ["fail", "不及格"];
}

const testLabels = {
  male: { strength: "引体向上", endurance: "1000 米跑" },
  female: { strength: "1 分钟仰卧起坐", endurance: "800 米跑" },
};

function calculateFitness({ sex, year, height, weight, lung, sprint, reach, jump, strength, minutes, seconds }) {
  const tables = fitnessTables[sex][year];
  const bmi = calculateBmi(height, weight);
  const [bmiScore, bmiClass] = scoreBmi(bmi, sex);
  const time = minutes * 60 + seconds;
  const strengthBonus = Math.max(0, Math.min(10, strength - tables.strength[0][1]));
  const secondsFaster = tables.endurance[0][1] - time;
  const enduranceBonus = scoreAtThreshold(secondsFaster, fitnessTables[sex].enduranceBonus);
  const labels = testLabels[sex];
  const rows = [
    { name: "BMI", weight: 15, measured: bmi.toFixed(1), note: bmiClass, score: bmiScore },
    { name: "肺活量", weight: 15, measured: lung + " mL", score: scoreAtThreshold(lung, tables.lung) },
    { name: "50 米跑", weight: 20, measured: sprint + " 秒", score: scoreAtThreshold(sprint, tables.sprint, true) },
    { name: "坐位体前屈", weight: 10, measured: reach + " cm", score: scoreAtThreshold(reach, tables.reach) },
    { name: "立定跳远", weight: 10, measured: jump + " cm", score: scoreAtThreshold(jump, tables.jump) },
    { name: labels.strength, weight: 10, measured: strength + " 次", score: scoreAtThreshold(strength, tables.strength), bonus: strengthBonus },
    { name: labels.endurance, weight: 20, measured: minutes + ":" + String(seconds).padStart(2, "0"), score: scoreAtThreshold(time, tables.endurance, true), bonus: enduranceBonus },
  ];
  const weighted = rows.reduce((sum, row) => sum + row.score * row.weight, 0);
  const bonus = strengthBonus + enduranceBonus;
  const total = Math.round(weighted / 10) / 10 + bonus;
  return { rows, base: weighted / 100, bonus, total, grade: gradeFor(total) };
}

const byId = (id) => document.getElementById(id);
const form = byId("fitness-form");
const results = byId("results");
const formMessage = byId("form-message");
const numericInputs = [...form.querySelectorAll('input[type="number"]')];
const exampleValues = {
  male: [175, 65, 4400, 7.3, 15.4, 241, 15, 3, 47],
  female: [162, 53, 2900, 8.6, 19.5, 181, 47, 3, 49],
};

function selection() {
  return { sex: form.elements.sex.value, year: form.elements.year.value };
}

function refreshLabels() {
  const labels = testLabels[selection().sex];
  byId("strength-label").textContent = labels?.strength ?? "引体向上 / 仰卧起坐";
  byId("endurance-label").textContent = labels?.endurance ?? "1000 米 / 800 米跑";
  const height = byId("height");
  const weight = byId("weight");
  const hasBmi = height.validity.valid && weight.validity.valid;
  byId("bmi-preview").textContent = hasBmi
    ? "BMI " + calculateBmi(height.valueAsNumber, weight.valueAsNumber).toFixed(1)
    : "BMI 自动计算";
}

function clearError() {
  formMessage.hidden = true;
  const invalid = form.querySelector('[aria-invalid="true"]');
  invalid?.removeAttribute("aria-invalid");
  invalid?.removeAttribute("aria-describedby");
}

function showError(input, message) {
  input.setAttribute("aria-invalid", "true");
  input.setAttribute("aria-describedby", formMessage.id);
  formMessage.textContent = message;
  formMessage.hidden = false;
  input.focus();
}

function numberError(input) {
  const name = input.getAttribute("aria-label") ?? input.labels[0].textContent.trim().split("\n")[0];
  if (input.validity.valueMissing) return "请填写" + name + "。";
  if (input.id === "seconds") return "耐力跑的秒数请输入 0 到 59 之间的整数。";
  if (input.validity.rangeUnderflow) return name + "不能小于 " + input.min + "。";
  if (input.validity.stepMismatch) return name + (input.step === "1" ? "请输入整数。" : "最多保留一位小数。");
  return "请检查" + name + "的输入。";
}

function clearResults() {
  const status = byId("result-status");
  status.textContent = "待计算";
  delete status.dataset.grade;
  byId("score-context").textContent = "学年总分";
  byId("total-score").textContent = "—";
  byId("empty-note").hidden = false;
  byId("score-parts").hidden = true;
  byId("result-detail").hidden = true;
  byId("score-rows").replaceChildren();
}

function renderRows(rows) {
  const body = byId("score-rows");
  body.replaceChildren();
  for (const row of rows) {
    const tr = body.insertRow();
    const header = document.createElement("th");
    header.scope = "row";
    header.textContent = row.name;
    const note = document.createElement("span");
    note.className = "row-note";
    note.textContent = row.weight + "%" + (row.note ? " · " + row.note : "");
    header.append(note);
    tr.append(header);
    tr.insertCell().textContent = row.measured;
    tr.insertCell().textContent = row.score;
    tr.insertCell().textContent = ((row.score * row.weight) / 100).toFixed(1);
    const bonus = tr.insertCell();
    bonus.textContent = row.bonus ? "+" + row.bonus : "—";
    if (row.bonus) bonus.className = "bonus-value";
  }
}

function renderResult(data, { sex, year }) {
  const [grade, label] = data.grade;
  const status = byId("result-status");
  status.textContent = label;
  status.dataset.grade = grade;
  byId("score-context").textContent = (sex === "male" ? "男生" : "女生") + " · " +
    (year === "year1" ? "大一 / 大二" : "大三 / 大四") + " · 学年总分";
  byId("total-score").textContent = data.total.toFixed(1);
  byId("base-score").textContent = data.base.toFixed(1);
  byId("bonus-score").textContent = "+" + data.bonus;
  byId("empty-note").hidden = true;
  byId("score-parts").hidden = false;
  byId("result-detail").hidden = false;
  renderRows(data.rows);
  results.focus({ preventScroll: true });
  results.scrollIntoView({ block: "start" });
}

form.addEventListener("input", () => {
  clearError();
  refreshLabels();
  if (!byId("result-detail").hidden) clearResults();
});

form.addEventListener("reset", () => {
  clearError();
  clearResults();
  queueMicrotask(refreshLabels);
});

byId("example").addEventListener("click", () => {
  const { sex = "male", year = "year1" } = Object.fromEntries(new FormData(form));
  form.querySelector('input[value="' + sex + '"]').checked = true;
  form.querySelector('input[value="' + year + '"]').checked = true;
  numericInputs.forEach((input, index) => { input.value = exampleValues[sex][index]; });
  clearError();
  clearResults();
  refreshLabels();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearError();
  const profile = selection();
  if (!profile.sex) return showError(form.elements.sex[0], "请选择性别。");
  if (!profile.year) return showError(form.elements.year[0], "请选择年级组。");
  const invalid = numericInputs.find((input) => !input.validity.valid || !Number.isFinite(input.valueAsNumber));
  if (invalid) return showError(invalid, numberError(invalid));
  const values = Object.fromEntries(numericInputs.map((input) => [input.name, input.valueAsNumber]));
  if (values.minutes === 0 && values.seconds === 0) {
    return showError(byId("minutes"), "耐力跑用时必须大于 0 秒。");
  }
  renderResult(calculateFitness({ ...profile, ...values }), profile);
});

refreshLabels();
form.querySelector('[type="submit"]').disabled = false;
