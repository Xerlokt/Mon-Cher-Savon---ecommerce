export interface CepAddress {
  street: string;
  district: string;
  city: string;
  state: string;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Looks up an address by CEP on ViaCEP. Returns null when not found or on any failure. */
export async function lookupCep(
  cep: string,
  fetchImpl: FetchLike = (url) => fetch(url),
): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, string | boolean | undefined>;
    if (data['erro']) return null;
    return {
      street: String(data['logradouro'] ?? ''),
      district: String(data['bairro'] ?? ''),
      city: String(data['localidade'] ?? ''),
      state: String(data['uf'] ?? ''),
    };
  } catch {
    return null;
  }
}
