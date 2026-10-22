import { describe, expect, it } from 'vitest'

import { createDisconnectAiProvider } from '@/lib/modules/integraciones/domain/disconnect-ai-provider'

import {
  COMPANY_ID,
  OTHER_COMPANY_ID,
  admin,
  makeCipher,
  makeRepository,
  storedConnection,
} from './ai-provider-doubles'

describe('desconectar el proveedor IA', () => {
  it('R20: borra la fila de la empresa, key cifrada incluida, y responde disconnected', async () => {
    const cipher = makeCipher()
    const repo = makeRepository([storedConnection(cipher.seed)])

    const result = await createDisconnectAiProvider({ connections: repo.connections })(admin())

    expect(result).toEqual({ status: 'disconnected' })
    expect(repo.remove).toHaveBeenCalledWith({ companyId: COMPANY_ID })
    expect(repo.rows()).toEqual([])
  })

  it('R20: sin conexion responde igual, sin error y sin cambiar nada', async () => {
    const cipher = makeCipher()
    const other = storedConnection(cipher.seed, {
      id: '00000000-0000-4000-8000-0000000000e1',
      companyId: OTHER_COMPANY_ID,
    })
    const repo = makeRepository([other])
    const disconnect = createDisconnectAiProvider({ connections: repo.connections })

    expect(await disconnect(admin())).toEqual({ status: 'disconnected' })
    expect(await disconnect(admin())).toEqual({ status: 'disconnected' })
    expect(repo.rows()).toEqual([other])
  })

  it('R20: no lee la conexion, no descifra ni la actualiza: solo borra', async () => {
    const cipher = makeCipher()
    const repo = makeRepository([storedConnection(cipher.seed)])
    await createDisconnectAiProvider({ connections: repo.connections })(admin())

    expect(cipher.decrypt).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
  })
})
