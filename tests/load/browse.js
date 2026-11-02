// Load test for the public store: finds how many visitors browsing at once the site can handle.
// It only sends GET requests, so it never creates orders or changes data.
// How to run it and read the results: see "Load testing" in the README.
import exec from 'k6/execution'
import { check, sleep } from 'k6'
import http from 'k6/http'

const baseUrl = __ENV.BASE_URL?.replace(/\/$/, '')
if (!baseUrl) throw new Error('Set BASE_URL, e.g. -e BASE_URL=https://your-site.up.railway.app')

// Each step ramps up to this many visitors at once, then holds there.
const steps = (__ENV.STEPS ?? '10,25,50,100').split(',').map(Number)
const holdSeconds = Number(__ENV.HOLD_SECONDS ?? 120)
const rampSeconds = Number(__ENV.RAMP_SECONDS ?? 30)

const headers = { 'Accept-Encoding': 'br, gzip' }

export const options = {
  scenarios: {
    visitors: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        ...steps.flatMap((target) => [
          { duration: `${rampSeconds}s`, target },
          { duration: `${holdSeconds}s`, target },
        ]),
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Stops the run once the site is clearly overloaded, so it doesn't keep costing usage.
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    // One result line per step in the summary. The first step that fails is past the limit.
    ...Object.fromEntries(
      steps.flatMap((target) => [
        [`http_req_duration{step:${target}}`, ['p(95)<1000']],
        [`http_req_failed{step:${target}}`, ['rate<0.01']],
      ]),
    ),
  },
}

// The visitor count of the step being held; requests made while ramping aren't counted to any step.
function currentStep() {
  const elapsed = (Date.now() - exec.scenario.startTime) / 1000
  const position = elapsed % (rampSeconds + holdSeconds)
  const index = Math.floor(elapsed / (rampSeconds + holdSeconds))
  return index < steps.length && position >= rampSeconds ? String(steps[index]) : 'ramp'
}

function get(path, responseType) {
  const response = http.get(`${baseUrl}${path}`, { headers, responseType, tags: { step: currentStep() } })
  check(response, { 'status is 200': (r) => r.status === 200 })
  return response
}

const pause = () => sleep(2 + Math.random() * 6)

// A first-time visitor: nothing is cached, so this is heavier than a returning customer.
export default function () {
  const page = get('/', 'text')
  for (const asset of String(page.body).match(/\/assets\/[^"]+/g) ?? []) get(asset, 'none')
  get('/api/store-settings', 'none')
  pause()

  const products = get('/api/products', 'text')
  for (const image of (String(products.body).match(/\/media\/[^"]+/g) ?? []).slice(0, 4)) get(image, 'none')
  pause()

  get('/api/packages', 'none')
  pause()

  get('/api/cities', 'none')
  get('/api/distributors', 'none')
  pause()
}
