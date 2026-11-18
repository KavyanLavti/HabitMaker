// Food recognition: photo or text in, nutrition per item out.
// Two interchangeable providers share one prompt and one output schema. Switch in Settings → FOOD AI.
// Keys live in SecureStore (never in settings, backups or the repo).
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import Anthropic from '@anthropic-ai/sdk';
import { cleanAiItems, FoodNutrition, MICROS, MICRO_KEYS } from './nutrition';

export type FoodAiProvider = 'gemini' | 'claude';

export const DEFAULT_MODELS: Record<FoodAiProvider, string> = {
  gemini: 'gemini-flash-latest',
  claude: 'claude-opus-5-5',
};

export const PROVIDER_INFO: Record<FoodAiProvider, { label: string; keyHint: string; where: string }> = {
  gemini: {
    label: 'GOOGLE GEMINI',
    keyHint: 'AIza…',
    where: 'Free key: aistudio.google.com → Get API key. The free tier covers a few meals a day.',
  },
  claude: {
    label: 'CLAUDE',
    keyHint: 'sk-ant-…',
    where: 'Key from platform.claude.com → API keys. Billed per use; a Claude Pro chat subscription does not include API access.',
  },
};

const keyName = (p: FoodAiProvider) => `food_ai_key_${p}`;
export const getFoodAiKey = (p: FoodAiProvider) => SecureStore.getItemAsync(keyName(p));
export async function setFoodAiKey(p: FoodAiProvider, key: string | null) {
  if (key && key.trim()) await SecureStore.setItemAsync(keyName(p), key.trim());
  else await SecureStore.deleteItemAsync(keyName(p));
}

export interface FoodImage {
  base64: string;
  mimeType: 'image/jpeg';
  uri: string;
}

export interface AnalyseInput {
  image?: FoodImage;
  /** Free text: a description, or extra context for the photo ("half the plate was shared"). */
  text?: string;
}

export interface AnalyseResult {
  items: FoodNutrition[];
  notes: string;
}

export class FoodAiError extends Error {}

// ---------- Photo capture ----------

/** Opens the camera (or gallery) and returns a JPEG no larger than 1280 px, small enough for either provider. */
export async function pickFoodImage(from: 'camera' | 'gallery'): Promise<FoodImage | null> {
  if (from === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new FoodAiError('Camera permission is off. Allow it in Android settings → Apps → HabitForge → Permissions.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const landscape = (asset.width ?? 0) > (asset.height ?? 0);
  const ref = await ImageManipulator.manipulate(asset.uri)
    .resize(landscape ? { width: 1280 } : { height: 1280 })
    .renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new FoodAiError('Could not read the photo.');
  return { base64: out.base64, mimeType: 'image/jpeg', uri: out.uri };
}

// ---------- Shared prompt and schema ----------

const MICRO_LIST = MICROS.map((m) => `${m.key} (${m.unit})`).join(', ');

const SYSTEM_PROMPT = `You are a nutritionist who knows Indian home, restaurant and street food well.
List every distinct food or drink the user ate, one item each (e.g. "roti", "dal tadka", "jeera rice", "cucumber raita", "masala chai").
Estimate the portion actually shown or described, in Indian household measures where natural (roti/phulka count, katori ≈ 150 ml, ladle, glass ≈ 250 ml, piece, plate), and give its weight in grams.
Give nutrition for that portion, not per 100 g. Base values on the Indian Food Composition Tables (IFCT 2017) or standard references, and include the ghee/oil typical of the dish as it is usually made unless it is clearly dry.
Micronutrients, for the portion: ${MICRO_LIST}. Use 0 only when the food truly has essentially none.
Use plain English dish names (Hindi names are fine, e.g. "poha", "rajma").
In notes, briefly mention any assumption the user may want to correct (hidden oil, sugar in tea, portion you could not see). Keep notes under 25 words.
If the photo shows no food, return an empty items list and say so in notes.`;

const NUM = { type: 'number' } as const;
const microProps = Object.fromEntries(MICRO_KEYS.map((k) => [k, NUM]));
const itemProps = {
  name: { type: 'string' },
  quantity: { type: 'string' },
  grams: NUM,
  calories: NUM,
  protein_g: NUM,
  carbs_g: NUM,
  fat_g: NUM,
  fiber_g: NUM,
  micros: { type: 'object', properties: microProps, required: MICRO_KEYS, additionalProperties: false },
};

/** JSON Schema (Claude structured outputs: every object closed, every field required). */
const JSON_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { type: 'object', properties: itemProps, required: Object.keys(itemProps), additionalProperties: false },
    },
    notes: { type: 'string' },
  },
  required: ['items', 'notes'],
  additionalProperties: false,
};

/** Same schema in Gemini's OpenAPI subset (upper-case types, no additionalProperties). */
function toGeminiSchema(s: any): any {
  const out: any = { type: String(s.type).toUpperCase() };
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    out.required = s.required;
  }
  if (s.items) out.items = toGeminiSchema(s.items);
  return out;
}
const GEMINI_SCHEMA = toGeminiSchema(JSON_SCHEMA);

function userText(input: AnalyseInput): string {
  const extra = input.text?.trim();
  if (input.image) return extra ? `Here is my meal. Extra detail from me: ${extra}` : 'Here is my meal.';
  return `I ate: ${extra}`;
}

function parseResult(text: string): AnalyseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new FoodAiError('The AI reply was not readable. Try again.');
  }
  return { items: cleanAiItems(data), notes: String(data?.notes ?? '').trim() };
}

// ---------- Providers ----------

async function analyseWithGemini(input: AnalyseInput, apiKey: string, model: string): Promise<AnalyseResult> {
  const parts: any[] = [];
  if (input.image) parts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.base64 } });
  parts.push({ text: userText(input) });

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: GEMINI_SCHEMA, temperature: 0.2 },
      }),
    });
  } catch {
    throw new FoodAiError('No internet connection. Log it by typing once you are back online, or try again.');
  }
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429) throw new FoodAiError(`Gemini's free limit is used up for now. Try again later. (${msg})`);
    if (res.status === 400 && /api key/i.test(msg)) throw new FoodAiError('The Gemini API key was rejected. Check it in Settings → FOOD AI.');
    if (res.status === 403) throw new FoodAiError(`Gemini refused the key: ${msg}`);
    if (res.status === 404) throw new FoodAiError(`Gemini model "${model}" was not found. Fix the model name in Settings → FOOD AI.`);
    throw new FoodAiError(`Gemini error: ${msg}`);
  }
  const cand = body?.candidates?.[0];
  if (!cand?.content?.parts?.length) {
    throw new FoodAiError(`Gemini returned nothing${cand?.finishReason ? ` (${cand.finishReason})` : ''}. Try another photo.`);
  }
  const text = cand.content.parts.filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('');
  return parseResult(text);
}

async function analyseWithClaude(input: AnalyseInput, apiKey: string, model: string): Promise<AnalyseResult> {
  // The key is the user's own, stored on their own device, so in-app use is intended here.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: input.image.mimeType, data: input.image.base64 } });
  }
  content.push({ type: 'text', text: userText(input) });

  try {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: JSON_SCHEMA } },
      // On a safety decline, the API retries on a fallback model inside the same call
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (res.stop_reason === 'refusal') throw new FoodAiError('Claude declined this request. Try a different photo or describe the meal.');
    if (res.stop_reason === 'max_tokens') throw new FoodAiError('The reply was cut off. Try fewer items at once.');
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return parseResult(text);
  } catch (e) {
    if (e instanceof FoodAiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new FoodAiError('The Claude API key was rejected. Check it in Settings → FOOD AI.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new FoodAiError(`Claude refused the key: ${e.message}`);
    if (e instanceof Anthropic.NotFoundError) throw new FoodAiError(`Claude model "${model}" was not found. Fix the model name in Settings → FOOD AI.`);
    if (e instanceof Anthropic.RateLimitError) throw new FoodAiError('Claude rate limit hit. Wait a minute and try again.');
    if (e instanceof Anthropic.BadRequestError) throw new FoodAiError(`Claude rejected the request: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new FoodAiError('No internet connection. Try again, or log it by typing later.');
    if (e instanceof Anthropic.APIError) throw new FoodAiError(`Claude error ${e.status ?? ''}: ${e.message}`);
    throw e;
  }
}

/** Runs the chosen provider. Throws FoodAiError with a message meant for the user. */
export async function analyseFood(input: AnalyseInput, provider: FoodAiProvider, modelOverride?: string): Promise<AnalyseResult> {
  if (!input.image && !input.text?.trim()) throw new FoodAiError('Take a photo or describe what you ate.');
  const key = await getFoodAiKey(provider);
  if (!key) throw new FoodAiError(`Add your ${PROVIDER_INFO[provider].label} API key in Settings → FOOD AI first.`);
  const model = modelOverride?.trim() || DEFAULT_MODELS[provider];
  return provider === 'claude' ? analyseWithClaude(input, key, model) : analyseWithGemini(input, key, model);
}
