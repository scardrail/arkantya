/**
 * Système Arkantya pour Foundry VTT v13
 */

const { ActorSheet } = foundry.appv1.sheets;

/* -------------------------------------------- */
/*  Jets                                        */
/* -------------------------------------------- */

/**
 * @param {Actor} actor
 * @param {object} opts
 * @param {string} opts.attrKey
 * @param {string} [opts.skillKey]  attributs fixes
 * @param {number} [opts.compIndex] combativité / arkanes
 * @param {number} [opts.situational]
 * @param {number} [opts.talent]
 */
async function rollArkantyaTest(actor, { attrKey, skillKey, compIndex, situational = 0, talent = 0 } = {}) {
  const sys = actor.system;
  let attrVal;
  let skillVal = 0;
  let label;
  /** @type {string} */
  let skillBreakdownName;

  const attrLabel = game.i18n.localize(`ARKANTYA.ATTR.${attrKey}`);

  if (["constitution", "esprit", "dexterite", "habilete"].includes(attrKey)) {
    attrVal = Number(sys.attributs[attrKey]?.value ?? 10);
    skillVal = Number(foundry.utils.getProperty(sys.attributs, `${attrKey}.competences.${skillKey}`) ?? 0);
    skillBreakdownName = game.i18n.localize(`ARKANTYA.COMP.${skillKey}`);
    label = `${attrLabel} — ${skillBreakdownName}`;
  } else if (attrKey === "combativite" || attrKey === "arkanes") {
    attrVal = Number(sys.attributs[attrKey]?.value ?? 10);
    const comp = sys.attributs[attrKey]?.competences?.[compIndex];
    skillVal = Number(comp?.value ?? 0);
    const nom = comp?.nom?.trim() || `Compétence ${compIndex + 1}`;
    skillBreakdownName = nom;
    label = `${attrLabel} — ${nom}`;
  } else return;

  const situationalN = Number(situational);
  const talentN = Number(talent);
  const threshold = attrVal + skillVal + talentN + situationalN;
  const roll = await new Roll("1d20").roll();
  const natural = roll.total;
  let outcome;
  let outcomeKey;
  if (natural === 1) {
    outcome = "critSuccess";
    outcomeKey = "CritSuccess";
  } else if (natural === 20) {
    outcome = "critFail";
    outcomeKey = "CritFail";
  } else if (natural <= threshold) {
    outcome = "success";
    outcomeKey = "Success";
  } else {
    outcome = "fail";
    outcomeKey = "Failure";
  }

  const outcomeText = game.i18n.localize(`ARKANTYA.ROLL.${outcomeKey}`);
  const cls =
    outcome === "critSuccess" ? "crit-success" : outcome === "critFail" ? "crit-fail" : "";

  const i18nFmt = (key, data) => game.i18n.format(`ARKANTYA.ROLL.${key}`, data);
  const breakdown = `
  <ul class="threshold-breakdown">
    <li>${i18nFmt("BreakdownAttr", { name: attrLabel, value: attrVal })}</li>
    <li>${i18nFmt("BreakdownSkill", { name: skillBreakdownName, value: skillVal })}</li>
    <li>${i18nFmt("BreakdownTalent", { value: talentN })}</li>
    <li>${i18nFmt("BreakdownSituational", { value: situationalN })}</li>
  </ul>
  <div class="threshold-sum">${i18nFmt("BreakdownTotal", {
    a: attrVal,
    b: skillVal,
    c: talentN,
    d: situationalN
  })} = <strong>${threshold}</strong></div>
  <div class="threshold-natural">${i18nFmt("BreakdownNaturalVs", { natural, total: threshold })}</div>`;

  const detail = `
<div class="arkantya chat-arkantya ${cls}">
  <div><strong>${label}</strong></div>
  ${breakdown}
  <div class="outcome">${outcomeText}</div>
</div>`;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: detail
  });
}

async function promptModifiersAndRoll(actor, baseOpts) {
  const mods = await new Promise((resolve) => {
    new Dialog(
      {
        title: game.i18n.localize("ARKANTYA.ROLL.Title"),
        content: `
<form class="arkantya-roll-dialog">
  <div class="form-group">
    <label>${game.i18n.localize("ARKANTYA.ROLL.Modifier")}</label>
    <input type="number" name="situational" value="0" data-dtype="Number"/>
  </div>
  <div class="form-group">
    <label>${game.i18n.localize("ARKANTYA.ROLL.TalentBonus")}</label>
    <input type="number" name="talent" value="0" min="0" data-dtype="Number"/>
  </div>
</form>`,
        buttons: {
          go: {
            icon: '<i class="fas fa-dice-d20"></i>',
            label: game.i18n.localize("ARKANTYA.ROLL.Roll"),
            callback: (html) => {
              const s = Number(html.find('[name="situational"]').val() ?? 0);
              const t = Number(html.find('[name="talent"]').val() ?? 0);
              resolve({ situational: s, talent: t });
            }
          },
          skip: {
            label: "Jet simple (0 / 0)",
            callback: () => resolve({ situational: 0, talent: 0 })
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(null)
          }
        },
        default: "go"
      },
      { classes: ["arkantya-roll"] }
    ).render(true);
  });

  if (mods === null) return;
  await rollArkantyaTest(actor, { ...baseOpts, ...mods });
}

/**
 * Clone une liste en tableau mutable. Foundry peut exposer un Array comme objet { "0": …, "1": … }.
 * @param {unknown} raw
 * @returns {object[]}
 */
function cloneDocumentArray(raw) {
  const dup = foundry.utils.duplicate(raw);
  if (Array.isArray(dup)) return dup;
  if (dup && typeof dup === "object") {
    const keys = Object.keys(dup).filter((k) => /^\d+$/.test(k));
    if (keys.length) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => foundry.utils.duplicate(dup[k]));
    }
  }
  return [];
}

/* -------------------------------------------- */
/*  Feuilles d'acteur                           */
/* -------------------------------------------- */

/** Base commune : conserve l’onglet actif après re-render (update d’acteur, etc.). */
class ArkantyaActorSheetBase extends ActorSheet {
  async _render(force = false, options = {}) {
    const tab = this._getActivePrimaryTab();
    await super._render(force, options);
    if (tab) this._restorePrimaryTab(tab);
  }

  _getActivePrimaryTab() {
    const el = this.element;
    if (!el?.length) return null;
    const $active = el.find(".sheet-tabs .item.active").first();
    if (!$active.length) return null;
    return $active.data("tab") ?? null;
  }

  _restorePrimaryTab(tab) {
    const el = this.element;
    if (!el?.length || !tab) return;
    const $pane = el.find(`.sheet-body-main > .tab[data-tab="${tab}"]`);
    if (!$pane.length) return;
    el.find(".sheet-tabs .item").removeClass("active");
    el.find(`.sheet-tabs .item[data-tab="${tab}"]`).addClass("active");
    el.find(".sheet-body-main > .tab").removeClass("active");
    $pane.addClass("active");
  }
}

class ArkantyaCharacterSheet extends ArkantyaActorSheetBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["arkantya", "sheet", "actor", "character"],
      template: "systems/arkantya/templates/actor-character.hbs",
      width: 900,
      height: 920,
      scrollY: [".sheet-body-main"]
    });
  }

  async getData(options = {}) {
    const context = await super.getData(options);
    context.system = foundry.utils.duplicate(this.actor.system);
    context.system.talents = cloneDocumentArray(this.actor.system.talents);
    context.isGM = game.user.isGM;
    context.resistanceValue = Number(
      this.actor.system?.attributs?.constitution?.competences?.resistance ?? 0
    );
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".sheet-tabs .item").on("click", (ev) => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab;
      const tabs = html.find(".sheet-tabs .item");
      tabs.removeClass("active");
      $(ev.currentTarget).addClass("active");
      html.find(".sheet-body-main > .tab").removeClass("active");
      html.find(`.sheet-body-main > .tab[data-tab="${tab}"]`).addClass("active");
    });

    html.find(".btn-roll").on("click", this._onRoll.bind(this));
    html.find("button.roll-destin").on("click", this._onRollDestin.bind(this));
    html.find("button[data-add-combat]").on("click", this._onAddCombat.bind(this));
    html.find("button[data-add-arkanes]").on("click", this._onAddArkanes.bind(this));
    html.find("button[data-add-talent]").on("click", this._onAddTalent.bind(this));
    html.find("button[data-remove-talent]").on("click", this._onRemoveTalent.bind(this));
  }

  async _onRoll(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const attrKey = btn.dataset.roll;
    const skillKey = btn.dataset.skill;
    const compIndex = btn.dataset.idx !== undefined ? Number(btn.dataset.idx) : undefined;
    await promptModifiersAndRoll(this.actor, { attrKey, skillKey, compIndex });
  }

  async _onRollDestin(event) {
    event.preventDefault();
    const roll = await new Roll("1d6").roll();
    await this.actor.update({ "system.session.destin": roll.total });
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<p><strong>Destin</strong> (séance) : ${roll.total}</p>`
    });
    this.render(false);
  }

  async _onAddCombat() {
    const list = cloneDocumentArray(this.actor.system.attributs.combativite.competences);
    list.push({ id: foundry.utils.randomID(), nom: "", value: 0 });
    await this.actor.update({ "system.attributs.combativite.competences": list });
  }

  async _onAddArkanes() {
    const list = cloneDocumentArray(this.actor.system.attributs.arkanes.competences);
    list.push({ id: foundry.utils.randomID(), nom: "", value: 0 });
    await this.actor.update({ "system.attributs.arkanes.competences": list });
  }

  async _onAddTalent(event) {
    event.preventDefault();
    const talents = cloneDocumentArray(this.actor.system.talents);
    talents.push({ name: "", value: 0, description: "" });
    await this.actor.update({ "system.talents": talents });
  }

  async _onRemoveTalent(event) {
    event.preventDefault();
    const idx = Number(event.currentTarget.dataset.removeTalent);
    const talents = cloneDocumentArray(this.actor.system.talents);
    talents.splice(idx, 1);
    await this.actor.update({ "system.talents": talents });
  }
}

class ArkantyaNpcSheet extends ArkantyaActorSheetBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["arkantya", "sheet", "actor", "npc"],
      template: "systems/arkantya/templates/actor-npc.hbs",
      width: 720,
      height: 780,
      scrollY: [".sheet-body-main"]
    });
  }

  async getData(options = {}) {
    const context = await super.getData(options);
    context.system = this.actor.system;
    context.isGM = game.user.isGM;
    context.resistanceValue = Number(
      this.actor.system?.attributs?.constitution?.competences?.resistance ?? 0
    );
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".sheet-tabs .item").on("click", (ev) => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab;
      html.find(".sheet-tabs .item").removeClass("active");
      $(ev.currentTarget).addClass("active");
      html.find(".sheet-body-main > .tab").removeClass("active");
      html.find(`.sheet-body-main > .tab[data-tab="${tab}"]`).addClass("active");
    });
    html.find(".btn-roll").on("click", this._onRoll.bind(this));
    html.find("button[data-add-combat]").on("click", this._onAddCombat.bind(this));
    html.find("button[data-add-arkanes]").on("click", this._onAddArkanes.bind(this));
  }

  async _onRoll(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    await promptModifiersAndRoll(this.actor, {
      attrKey: btn.dataset.roll,
      skillKey: btn.dataset.skill,
      compIndex: btn.dataset.idx !== undefined ? Number(btn.dataset.idx) : undefined
    });
  }

  async _onAddCombat() {
    const list = cloneDocumentArray(this.actor.system.attributs.combativite.competences);
    list.push({ id: foundry.utils.randomID(), nom: "", value: 0 });
    await this.actor.update({ "system.attributs.combativite.competences": list });
  }

  async _onAddArkanes() {
    const list = cloneDocumentArray(this.actor.system.attributs.arkanes.competences);
    list.push({ id: foundry.utils.randomID(), nom: "", value: 0 });
    await this.actor.update({ "system.attributs.arkanes.competences": list });
  }
}

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", async () => {
  await loadTemplates(["systems/arkantya/templates/parts/fixed-two-skills.hbs"]);

  CONFIG.ARKANTYA = { rollArkantyaTest, promptModifiersAndRoll };

  if (!Handlebars.helpers.concat) {
    Handlebars.registerHelper("concat", (...args) => {
      args.pop();
      return args.join("");
    });
  }

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("arkantya", ArkantyaCharacterSheet, {
    types: ["character"],
    makeDefault: true
  });
  Actors.registerSheet("arkantya", ArkantyaNpcSheet, {
    types: ["npc"],
    makeDefault: true
  });

  CONFIG.Combat.initiative = {
    formula: "@system.session.destin",
    decimals: 0
  };
});

Hooks.once("i18nInit", () => {
  CONFIG.Actor.typeLabels = foundry.utils.mergeObject(CONFIG.Actor.typeLabels ?? {}, {
    character: game.i18n.localize("TYPES.Actor.character"),
    npc: game.i18n.localize("TYPES.Actor.npc")
  });
});
