"use strict";

const byId = (id) => document.getElementById(id);
const number = (id) => Number(byId(id).value);
const setText = (id, value) => { byId(id).textContent = value; };
const f5 = (value) => Number(value).toFixed(5);
const f2 = (value) => Number(value).toFixed(2);
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function showError(id, message) { byId(id).textContent = message || ""; }
function asDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) throw new Error("Please select valid receipt and issue dates.");
  return date;
}
function daysBetween(first, second) {
  return Math.round((second - first) / 86400000);
}

function calculateSL(input) {
  const { type, receiptDate, issueDate, receipt, issue, initial, final } = input;
  if (!(receipt > 0)) throw new Error("Receipt quantity must be greater than zero.");
  const days = daysBetween(receiptDate, issueDate);
  if (days < 0) throw new Error("Issue date cannot be before receipt date.");
  let cut = 0, icar = 0, uncertainty = 0;

  if (type === "wheat-consuming") {
    const exempt = initial === final && days < 31;
    icar = exempt ? 0 : 0.618 * initial - 0.627 * final + 0.011 * days / 30;
    uncertainty = exempt ? 0 : 0.05;
  } else if (type === "wheat-procuring") {
    cut = initial > 12 ? -(final - initial) : final > 12 ? -(final - 12) : 0;
    if (initial > 12 && final > 12) icar = -(days * 0.007 / 30);
    else if (final >= 12) icar = initial * 0.578 - 12 * 0.579 - days * 0.007 / 30;
    else icar = initial * 0.578 - final * 0.579 - days * 0.007 / 30;
    const actualPercent = (receipt - issue) / receipt * 100;
    uncertainty = icar + 0.05 > actualPercent && (initial <= 12 || final <= 12) ? 0.05 : 0;
  } else {
    const rice = type === "rice-consuming"
      ? { a: 0.819, b: 0.822, sp: 0.01, uncertainty: 0.08 }
      : { a: 0.737, b: 0.753, sp: 0.0251, uncertainty: 0.06 };
    const closeMoisture = round2(14 - final) <= 0.2;
    const special = (initial === final || round2(initial - final) <= 0.2) && days <= 90;
    cut = initial >= 14 && final >= 14 ? initial - final : initial >= 14 ? initial - 14 : 0;
    if (initial > 14 && final >= 14) icar = rice.sp * days / 30;
    else if (initial > 14 && closeMoisture && days <= 90) icar = rice.sp * days / 30;
    else if (initial > 14) icar = rice.a * 14 - rice.b * final + rice.sp * days / 30;
    else if (special) icar = rice.uncertainty;
    else icar = rice.a * initial - rice.b * final + rice.sp * days / 30;
    uncertainty = initial >= 14 || special ? 0 : rice.uncertainty;
  }
  const gainLossQty = receipt - issue;
  const gainLossPercent = gainLossQty / receipt * 100;
  const allowedPercent = gainLossPercent > cut + icar + uncertainty ? cut + icar : cut + icar + uncertainty;
  const allowedQty = allowedPercent * receipt / 100;
  const unjustifiedLoss = gainLossQty - allowedQty;
  return { days, moistureChange: round2(initial - final), gainLossQty, gainLossPercent, allowedPercent, allowedQty, unjustifiedLoss, result: unjustifiedLoss <= 0 ? "JUSTIFIED" : "UNJUSTIFIED" };
}

function setupSL() {
  const form = byId("sl-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const result = calculateSL({
        type: byId("commodity").value,
        receiptDate: asDate(byId("receipt-date").value),
        issueDate: asDate(byId("issue-date").value),
        receipt: number("receipt-qty"), issue: number("issue-qty"),
        initial: number("initial-moisture"), final: number("final-moisture")
      });
      if (![result.gainLossQty, result.gainLossPercent, result.allowedPercent].every(Number.isFinite)) throw new Error("Enter valid numeric values in all fields.");
      showError("sl-error", "");
      setText("storage-days", `${result.days} days`);
      setText("moisture-change", `${f2(result.moistureChange)}%`);
      setText("gain-loss-qty", `${f5(result.gainLossQty)} Qtl`);
      setText("gain-loss-percent", `${f5(result.gainLossPercent)}%`);
      setText("allowed-gain-loss", `${f5(result.allowedPercent)}% | ${f5(result.allowedQty)} Qtl`);
      setText("unjustified-loss", `${f5(result.unjustifiedLoss)} Qtl`);
      const verdict = byId("sl-verdict");
      verdict.textContent = `RESULT: ${result.result}`;
      verdict.classList.toggle("unjustified", result.result === "UNJUSTIFIED");
      byId("sl-results").classList.remove("hidden");
      byId("sl-print").disabled = false;
    } catch (error) { showError("sl-error", error.message || "Enter valid values in all fields."); }
  });
  byId("sl-print").addEventListener("click", () => window.print());
}

function setupLoss() {
  byId("loss-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const total = number("total-weight"), current = number("current-weight"), target = number("target-loss");
      if (!(total > 0) || !Number.isFinite(current) || !Number.isFinite(target)) throw new Error("Enter valid numeric values. Total Weight must be greater than zero.");
      setText("loss-percent", `${f5(target / total * 100)}%`);
      setText("balance-weight", `${f5(total - (current + target))} Qtl`);
      byId("loss-results").classList.remove("hidden");
      showError("loss-error", "");
    } catch (error) { showError("loss-error", error.message); }
  });
}

function setupAverage() {
  byId("create-trucks").addEventListener("click", () => {
    const count = Number(byId("truck-count").value);
    if (!Number.isInteger(count) || count < 1 || count > 100) { showError("average-error", "Enter a truck count from 1 to 100."); return; }
    const rows = byId("truck-rows");
    rows.innerHTML = Array.from({ length: count }, (_, index) => `
      <div class="truck-row">
        <div class="truck-number">Truck ${index + 1}</div>
        <label>Bags<input class="truck-bags" type="number" min="0" step="0.00001" placeholder="0.00000" required></label>
        <label>Moisture %<input class="truck-moisture" type="number" min="0" step="0.01" placeholder="0.00" required></label>
      </div>`).join("");
    byId("average-form").classList.remove("hidden");
    byId("average-results").classList.add("hidden");
    showError("average-error", "");
  });
  byId("average-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const bags = [...document.querySelectorAll(".truck-bags")].map((input) => Number(input.value));
      const moisture = [...document.querySelectorAll(".truck-moisture")].map((input) => Number(input.value));
      if (bags.some((value) => !Number.isFinite(value)) || moisture.some((value) => !Number.isFinite(value))) throw new Error("Enter Bags and Moisture % for every truck.");
      const total = bags.reduce((sum, value) => sum + value, 0);
      if (!(total > 0)) throw new Error("Total Bags must be greater than zero.");
      const average = bags.reduce((sum, value, index) => sum + value * moisture[index], 0) / total;
      setText("total-bags", f5(total));
      setText("average-moisture", `${f2(average)}%`);
      byId("average-results").classList.remove("hidden");
      showError("average-error", "");
    } catch (error) { showError("average-error", error.message); }
  });
}

function setupChemical() {
  const form = byId("chemical-form");
  let type = "malathion";
  const field = (id, label, options = {}) => {
    const { kind = "number", step = "0.01", min = "0", placeholder = "0.00" } = options;
    if (kind === "select") return `<label>${label}<select id="${id}">${options.items.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}</select></label>`;
    return `<label>${label}<input id="${id}" type="${kind}" min="${min}" step="${step}" placeholder="${placeholder}" required></label>`;
  };
  const details = {
    malathion: {
      title: "Malathion Dosage", hint: "Dimensions are in metres",
      fields: () => field("chemical-length", "Length (m)") + field("chemical-breadth", "Breadth (m)") + field("chemical-height", "Height (m)") + field("chemical-stacks", "Number of Stacks", { step: "1", placeholder: "e.g. 1" })
    },
    deltamethrin: {
      title: "Deltamethrin Dosage", hint: "Dimensions are in metres",
      fields: () => field("chemical-length", "Length (m)") + field("chemical-breadth", "Breadth (m)") + field("chemical-height", "Height (m)") + field("chemical-stacks", "Number of Stacks", { step: "1", placeholder: "e.g. 1" })
    },
    operational: {
      title: "Operational Area", hint: "All dimensions are in metres",
      fields: () => field("godown-length", "Godown Length (m)") + field("godown-breadth", "Godown Breadth (m)") + field("stack-length", "Stack Length (m)") + field("stack-breadth", "Stack Breadth (m)") + field("chemical-stacks", "Number of Stacks", { step: "1", placeholder: "e.g. 1" })
    },
    aip: {
      title: "Aluminium Phosphide Dosage", hint: "Select the method and enter the applicable values",
      fields: () => field("aip-method", "Method", { kind: "select", items: [{ value: "cover", label: "Cover" }, { value: "cap", label: "CAP" }, { value: "shed", label: "Shed" }] }) + field("aip-weight", "Weight (MT)") + field("aip-volume", "Volume (g)") + field("aip-khapra", "Khapra Infestation?", { kind: "select", items: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] })
    }
  };
  const valid = (value, label) => {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Enter a valid ${label}.`);
    return value;
  };
  const resultRows = (rows) => {
    byId("chemical-result-grid").innerHTML = rows.map(({ label, value }) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
    byId("chemical-results").classList.remove("hidden");
  };
  const render = () => {
    const current = details[type];
    byId("chemical-form-title").textContent = current.title;
    byId("chemical-form-hint").textContent = current.hint;
    byId("chemical-inputs").innerHTML = current.fields();
    byId("chemical-results").classList.add("hidden");
    showError("chemical-error", "");
  };
  document.querySelectorAll("[data-chemical-type]").forEach((tab) => tab.addEventListener("click", () => {
    type = tab.dataset.chemicalType;
    document.querySelectorAll("[data-chemical-type]").forEach((item) => { const active = item === tab; item.classList.toggle("active", active); item.setAttribute("aria-selected", String(active)); });
    render();
  }));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      if (type === "malathion" || type === "deltamethrin") {
        const length = valid(number("chemical-length"), "Length");
        const breadth = valid(number("chemical-breadth"), "Breadth");
        const height = valid(number("chemical-height"), "Height");
        const stacks = valid(number("chemical-stacks"), "number of Stacks");
        const area = (2 * (length + breadth) * height + length * breadth) * 1.1;
        const solution = 3 * area / 100;
        if (type === "malathion") {
          const chemicalMl = solution / 100 * 1000;
          resultRows([{ label: "Surface Area", value: `${f2(area)} m²` }, { label: "Solution Required", value: `${f2(solution)} L` }, { label: "Chemical Required", value: `${f2(chemicalMl)} ml` }, { label: `Total for ${stacks} Stacks`, value: `${f2(chemicalMl * stacks)} ml` }]);
        } else {
          const chemicalG = 40 * solution;
          resultRows([{ label: "Surface Area", value: `${f2(area)} m²` }, { label: "Solution Required", value: `${f2(solution)} L` }, { label: "Chemical Required", value: `${f2(chemicalG)} g` }, { label: `Total for ${stacks} Stacks`, value: `${f2(chemicalG * stacks / 1000)} kg` }]);
        }
      } else if (type === "operational") {
        const totalL = valid(number("godown-length"), "Godown Length");
        const totalB = valid(number("godown-breadth"), "Godown Breadth");
        const stackL = valid(number("stack-length"), "Stack Length");
        const stackB = valid(number("stack-breadth"), "Stack Breadth");
        const stacks = valid(number("chemical-stacks"), "number of Stacks");
        resultRows([{ label: "Operational Area", value: `${f2(totalL * totalB - stackL * stackB * stacks)} m²` }]);
      } else {
        const method = byId("aip-method").value;
        const weight = valid(number("aip-weight"), "Weight");
        const volume = valid(number("aip-volume"), "Volume");
        let dose = method === "cover" ? 9 * weight : method === "cap" ? 9 * weight * 1.2 : 63 / 28 * volume;
        if (byId("aip-khapra").value === "yes") dose *= 1.5;
        resultRows([{ label: "AIP Dosage", value: `${f2(dose)} g` }]);
      }
      showError("chemical-error", "");
    } catch (error) { showError("chemical-error", error.message || "Enter valid values in all fields."); }
  });
  render();
}

if (document.body.dataset.page === "sl") setupSL();
if (document.body.dataset.page === "loss") setupLoss();
if (document.body.dataset.page === "average") setupAverage();
if (document.body.dataset.page === "chemical") setupChemical();
