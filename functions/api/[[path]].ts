import api from '../../worker/index'

interface Env {
  DB: D1Database
}

export async function onRequest(context: {
  request: Request
  env: Env
}): Promise<Response> {
  return api.fetch(context.request, context.env)
}
