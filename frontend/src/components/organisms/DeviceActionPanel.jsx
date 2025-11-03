import { useMemo, useState } from "react";
import Button from "../atoms/Button.jsx";

const ACTION_DEFINITIONS = {
  turn_on: { action: "turn_on", label: "Turn On", type: "button" },
  turn_off: { action: "turn_off", label: "Turn Off", type: "button" },
  set_brightness: {
    action: "set_brightness",
    label: "Brightness",
    type: "range",
    param: "brightness",
    min: 1,
    max: 100,
    step: 1,
    submitLabel: "Apply",
  },
  set_color_temp: {
    action: "set_color_temp",
    label: "Colour Temperature",
    type: "range",
    param: "color_temp",
    min: 1700,
    max: 6500,
    step: 100,
    submitLabel: "Apply",
  },
  set_rgb: {
    action: "set_rgb",
    label: "RGB",
    type: "form",
    submitLabel: "Apply",
    fields: [
      {
        name: "rgb",
        label: "RGB value (0 - 16777215)",
        type: "number",
        min: 0,
        max: 16777215,
        required: true,
        parseValue: (value) => Number(value),
      },
    ],
  },
  snapshot: { action: "snapshot", label: "Capture Snapshot", type: "button" },
  set_volume: {
    action: "set_volume",
    label: "Set Volume",
    type: "range",
    param: "level",
    min: 0,
    max: 100,
    step: 1,
    submitLabel: "Set",
  },
  volume_up: {
    action: "volume_up",
    label: "Volume Up",
    type: "form",
    submitLabel: "Increase",
    fields: [
      {
        name: "step",
        label: "Step",
        type: "number",
        min: 1,
        max: 50,
        defaultValue: 5,
        parseValue: (value) => Number(value),
      },
    ],
  },
  volume_down: {
    action: "volume_down",
    label: "Volume Down",
    type: "form",
    submitLabel: "Decrease",
    fields: [
      {
        name: "step",
        label: "Step",
        type: "number",
        min: 1,
        max: 50,
        defaultValue: 5,
        parseValue: (value) => Number(value),
      },
    ],
  },
  mute: {
    action: "mute",
    label: "Mute",
    type: "form",
    submitLabel: "Apply",
    fields: [
      {
        name: "on",
        label: "State",
        type: "select",
        defaultValue: "true",
        options: [
          { value: "true", label: "Mute" },
          { value: "false", label: "Unmute" },
        ],
        parseValue: (value) => value === "true",
      },
    ],
  },
  play_media: {
    action: "play_media",
    label: "Play Media",
    type: "form",
    submitLabel: "Play",
    fields: [
      {
        name: "url",
        label: "Media URL",
        type: "text",
        placeholder: "https://example.com/stream.mp3",
        required: true,
      },
      {
        name: "content_type",
        label: "Content type",
        type: "text",
        defaultValue: "audio/mp3",
      },
      {
        name: "stream_type",
        label: "Stream type",
        type: "select",
        defaultValue: "BUFFERED",
        options: [
          { value: "BUFFERED", label: "Buffered" },
          { value: "LIVE", label: "Live" },
        ],
      },
    ],
  },
  pause: { action: "pause", label: "Pause", type: "button" },
  play: { action: "play", label: "Play", type: "button" },
  stop: { action: "stop", label: "Stop", type: "button" },
  say: {
    action: "say",
    label: "Text-to-speech",
    type: "form",
    submitLabel: "Speak",
    fields: [
      {
        name: "text",
        label: "Message",
        type: "textarea",
        placeholder: "What should the speaker say?",
        required: true,
      },
      {
        name: "lang",
        label: "Language (ISO code)",
        type: "text",
        defaultValue: "en",
      },
    ],
  },
  launch_app: {
    action: "launch_app",
    label: "Launch App",
    type: "form",
    submitLabel: "Launch",
    fields: [
      {
        name: "app_id",
        label: "App ID / Name",
        type: "text",
        placeholder: "YouTube",
        required: true,
      },
    ],
  },
  status: { action: "status", label: "Get Status", type: "button" },
};

const CAPABILITY_ACTION_MAP = {
  on_off: ["turn_on", "turn_off"],
  brightness: ["set_brightness"],
  color_temp: ["set_color_temp"],
  rgb: ["set_rgb"],
  snapshot: ["snapshot"],
  volume: ["set_volume", "volume_up", "volume_down", "mute", "status"],
  launch: ["launch_app", "play_media", "pause", "play", "stop", "say", "status"],
};

const DEFAULT_PARSERS = {
  number: (value) => Number(value),
  select: (value) => value,
  text: (value) => value,
  textarea: (value) => value,
};

function buildActions(capabilities = []) {
  const seen = new Set();
  const result = [];

  capabilities.forEach((cap) => {
    const keys = CAPABILITY_ACTION_MAP[cap];
    if (!keys) return;
    keys.forEach((key) => {
      const def = ACTION_DEFINITIONS[key];
      if (!def || seen.has(def.action)) return;
      seen.add(def.action);
      result.push(def);
    });
  });

  return result;
}

function getRangeDefault(def) {
  if (typeof def.defaultValue !== "undefined") return def.defaultValue;
  if (typeof def.min !== "undefined" && typeof def.max !== "undefined") {
    return Math.round((def.min + def.max) / 2);
  }
  if (typeof def.min !== "undefined") return def.min;
  if (typeof def.max !== "undefined") return def.max;
  return 0;
}

export default function DeviceActionPanel({ capabilities, onExecute, busyAction }) {
  const quickActions = useMemo(() => buildActions(capabilities), [capabilities]);
  const [formState, setFormState] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [customAction, setCustomAction] = useState("");
  const [customParams, setCustomParams] = useState("");
  const [customError, setCustomError] = useState(null);

  const setActionError = (action, message) => {
    setFormErrors((prev) => {
      if (!message) {
        const next = { ...prev };
        delete next[action];
        return next;
      }
      return { ...prev, [action]: message };
    });
  };

  const getFieldValue = (action, field) => {
    const current = formState[action];
    if (current && Object.prototype.hasOwnProperty.call(current, field.name)) {
      return current[field.name];
    }
    if (typeof field.defaultValue !== "undefined") {
      return field.defaultValue;
    }
    if (field.type === "select" && field.options && field.options.length) {
      return field.options[0].value;
    }
    return "";
  };

  const updateFieldValue = (action, fieldName, value) => {
    setFormState((prev) => ({
      ...prev,
      [action]: { ...(prev[action] || {}), [fieldName]: value },
    }));
  };

  const handleButtonClick = (def) => {
    if (busyAction) return;
    setActionError(def.action, null);
    onExecute(def.action, def.params || {});
  };

  const handleRangeSubmit = (event, def) => {
    event.preventDefault();
    if (busyAction) return;
    const paramName = def.param || "value";
    const value =
      (formState[def.action] && formState[def.action][paramName]) ?? getRangeDefault(def);
    setActionError(def.action, null);
    onExecute(def.action, { [paramName]: Number(value) });
  };

  const handleFormSubmit = (event, def) => {
    event.preventDefault();
    if (busyAction) return;

    const params = {};
    for (const field of def.fields) {
      const rawValue = getFieldValue(def.action, field);
      const hasValue = !(rawValue === "" || rawValue === null || typeof rawValue === "undefined");
      if (field.required && !hasValue) {
        setActionError(def.action, `${field.label} is required`);
        return;
      }
      if (!hasValue) {
        continue;
      }
      const parser = field.parseValue || DEFAULT_PARSERS[field.type] || ((value) => value);
      const parsed = parser(rawValue);
      if (field.type === "number" && Number.isNaN(parsed)) {
        setActionError(def.action, `${field.label} must be a number`);
        return;
      }
      params[field.param || field.name] = parsed;
    }
    setActionError(def.action, null);
    onExecute(def.action, params);
  };

  const handleCustomSubmit = (event) => {
    event.preventDefault();
    if (busyAction) return;
    if (!customAction.trim()) {
      setCustomError("Action name is required");
      return;
    }
    let params = {};
    if (customParams.trim()) {
      try {
        params = JSON.parse(customParams);
      } catch (error) {
        setCustomError("Parameters must be valid JSON");
        return;
      }
    }
    setCustomError(null);
    onExecute(customAction.trim(), params);
  };

  return (
    <div className="device-card__actions">
      {quickActions.length ? (
        <>
          <div className="device-card__actions-header">Quick actions</div>
          <div className="device-card__actions-grid">
            {quickActions.map((def) => {
              if (def.type === "button") {
                return (
                  <div className="device-action" key={def.action}>
                    <div className="device-action__label">{def.label}</div>
                    <Button
                      type="button"
                      onClick={() => handleButtonClick(def)}
                      disabled={!!busyAction}
                    >
                      {def.label}
                    </Button>
                  </div>
                );
              }

              if (def.type === "range") {
                const paramName = def.param || "value";
                const value =
                  (formState[def.action] && formState[def.action][paramName]) ??
                  getRangeDefault(def);
                return (
                  <form
                    className="device-action"
                    key={def.action}
                    onSubmit={(event) => handleRangeSubmit(event, def)}
                  >
                    <label className="device-action__label" htmlFor={`${def.action}-range`}>
                      {def.label}: {value}
                    </label>
                    <input
                      id={`${def.action}-range`}
                      className="device-action__range"
                      type="range"
                      min={def.min}
                      max={def.max}
                      step={def.step || 1}
                      value={value}
                      onChange={(event) =>
                        updateFieldValue(def.action, paramName, Number(event.target.value))
                      }
                    />
                    <div className="device-action__range-inputs">
                      <input
                        type="number"
                        min={def.min}
                        max={def.max}
                        step={def.step || 1}
                        value={value}
                        className="device-action__number"
                        onChange={(event) =>
                          updateFieldValue(def.action, paramName, Number(event.target.value))
                        }
                      />
                      <Button type="submit" disabled={!!busyAction}>
                        {def.submitLabel || "Apply"}
                      </Button>
                    </div>
                    {formErrors[def.action] ? (
                      <div className="device-action__error">{formErrors[def.action]}</div>
                    ) : null}
                  </form>
                );
              }

              if (def.type === "form") {
                return (
                  <form
                    className="device-action"
                    key={def.action}
                    onSubmit={(event) => handleFormSubmit(event, def)}
                  >
                    <div className="device-action__label">{def.label}</div>
                    <div className="device-action__fields">
                      {def.fields.map((field) => {
                        const value = getFieldValue(def.action, field);
                        const commonProps = {
                          id: `${def.action}-${field.name}`,
                          name: field.name,
                          value,
                          onChange: (event) => updateFieldValue(def.action, field.name, event.target.value),
                          disabled: !!busyAction,
                        };

                        if (field.type === "textarea") {
                          return (
                            <div className="device-action__field" key={field.name}>
                              <label className="device-action__label" htmlFor={commonProps.id}>
                                {field.label}
                              </label>
                              <textarea
                                {...commonProps}
                                className="device-action__textarea"
                                placeholder={field.placeholder}
                                rows={field.rows || 3}
                              />
                            </div>
                          );
                        }

                        if (field.type === "select") {
                          return (
                            <div className="device-action__field" key={field.name}>
                              <label className="device-action__label" htmlFor={commonProps.id}>
                                {field.label}
                              </label>
                              <select
                                {...commonProps}
                                className="device-action__select"
                              >
                                {field.options?.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        return (
                          <div className="device-action__field" key={field.name}>
                            <label className="device-action__label" htmlFor={commonProps.id}>
                              {field.label}
                            </label>
                            <input
                              {...commonProps}
                              type={field.type}
                              className="device-action__input"
                              placeholder={field.placeholder}
                              min={field.min}
                              max={field.max}
                              step={field.step}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {formErrors[def.action] ? (
                      <div className="device-action__error">{formErrors[def.action]}</div>
                    ) : null}
                    <div className="device-action__form-actions">
                      <Button type="submit" disabled={!!busyAction}>
                        {def.submitLabel || "Send"}
                      </Button>
                    </div>
                  </form>
                );
              }

              return null;
            })}
          </div>
        </>
      ) : (
        <div className="device-card__actions-empty">
          No quick actions available for this device. Use a custom command below.
        </div>
      )}

      <div className="device-card__custom">
        <div className="device-card__actions-header">Custom command</div>
        <form className="device-card__custom-form" onSubmit={handleCustomSubmit}>
          <div className="device-card__custom-row">
            <label className="device-action__label" htmlFor="custom-action">
              Action
            </label>
            <input
              id="custom-action"
              className="device-action__input"
              type="text"
              placeholder="e.g. turn_on"
              value={customAction}
              onChange={(event) => {
                setCustomError(null);
                setCustomAction(event.target.value);
              }}
            />
          </div>
          <div className="device-card__custom-row">
            <label className="device-action__label" htmlFor="custom-params">
              Params (JSON)
            </label>
            <textarea
              id="custom-params"
              className="device-action__textarea"
              placeholder={'{"brightness": 80}'}
              value={customParams}
              onChange={(event) => {
                setCustomError(null);
                setCustomParams(event.target.value);
              }}
              rows={3}
            />
          </div>
          {customError ? <div className="device-card__custom-error">{customError}</div> : null}
          <div className="device-card__custom-submit">
            <Button type="submit" disabled={!!busyAction}>
              Send command
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

