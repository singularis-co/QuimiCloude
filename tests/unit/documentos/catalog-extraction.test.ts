// Interpretar el texto de catalogo que dejo la IA. Dominio puro: sin red y sin proveedor
// configurado.

import { describe, expect, it } from 'vitest';

import { extractCatalogFromText } from '@/lib/modules/documentos/domain/catalog-extraction';
import { ValidationError } from '@/lib/modules/documentos/domain/errors';

const LINEA_COMPLETA =
  '{"name":"Acido citrico","presentation":"Bolsa 25kg","unit":"kg","cost":"120.5000",' +
  '"minPurchase":"25","deliveryTime":3,"material":"plastico","measurements":' +
  '{"diameter":{"value":"7.5","unit":"cm"},"height":{"value":"12","unit":"cm"},"mouth":"28/410"},' +
  '"page":1}';

describe('documentos — interpretacion tolerante del texto de catalogo', () => {
  describe('R5 — tolera la forma del texto y de cada campo', () => {
    it('con VALLA de codigo ```json, se interpreta igual', () => {
      const texto = '```json\n{"lines":[' + LINEA_COMPLETA + ']}\n```';
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines).toHaveLength(1);
      expect(resultado.lines[0]?.name).toBe('Acido citrico');
    });

    it('con PROSA antes y despues del objeto, se interpreta igual', () => {
      const texto = `Aqui esta el catalogo:\n{"lines":[${LINEA_COMPLETA}]}\nEspero que sirva.`;
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines).toHaveLength(1);
    });

    it('"lines": null se interpreta como cero lineas', () => {
      const resultado = extractCatalogFromText('{"lines": null}');
      expect(resultado.lines).toEqual([]);
    });

    it('"lines" ausente se interpreta como cero lineas', () => {
      const resultado = extractCatalogFromText('{}');
      expect(resultado.lines).toEqual([]);
    });

    it('una clave desconocida en la raiz o en la linea se ignora', () => {
      const texto = `{"lines":[{"name":"Sosa","otraClave":123}], "raizDesconocida": true}`;
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines).toHaveLength(1);
      expect(resultado.lines[0]?.name).toBe('Sosa');
    });

    it('un tipo erroneo en un campo deja SOLO ese campo en null, la linea sobrevive', () => {
      const texto = '{"lines":[{"name":"Sosa","deliveryTime":"tres","material":42}]}';
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines).toHaveLength(1);
      expect(resultado.lines[0]?.name).toBe('Sosa');
      expect(resultado.lines[0]?.deliveryTime).toBeNull();
      expect(resultado.lines[0]?.material).toBeNull();
    });

    it('un elemento de "lines" que no es objeto se descarta', () => {
      const texto = '{"lines":["no es un objeto", 42, null, {"name":"Sosa"}]}';
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines).toHaveLength(1);
      expect(resultado.lines[0]?.name).toBe('Sosa');
    });

    it('claves ausentes o con valor null quedan como campo vacio (null)', () => {
      const texto = '{"lines":[{"name":"Sosa"}]}';
      const resultado = extractCatalogFromText(texto);
      const linea = resultado.lines[0];
      expect(linea?.presentation).toBeNull();
      expect(linea?.cost).toBeNull();
      expect(linea?.measurements).toBeNull();
    });

    it('un tipo erroneo dentro de "measurements" deja ese sub-campo en null sin perder la linea', () => {
      const texto =
        '{"lines":[{"name":"Sosa","measurements":{"diameter":"no es un objeto","height":null,"mouth":99}}]}';
      const resultado = extractCatalogFromText(texto);
      const linea = resultado.lines[0];
      expect(linea?.name).toBe('Sosa');
      expect(linea?.measurements?.diameter).toBeNull();
      expect(linea?.measurements?.height).toBeNull();
      expect(linea?.measurements?.mouth).toBeNull();
    });
  });

  describe('R6 — sin JSON interpretable, se rechaza el documento entero', () => {
    it('sin ningun objeto JSON en el texto -> ValidationError invalid_input', () => {
      let capturado: unknown;
      try {
        extractCatalogFromText('lo siento, no puedo procesar este documento');
      } catch (error) {
        capturado = error;
      }
      expect(capturado).toBeInstanceOf(ValidationError);
      expect((capturado as ValidationError).code).toBe('invalid_input');
    });

    it('JSON mal formado -> ValidationError invalid_input', () => {
      let capturado: unknown;
      try {
        extractCatalogFromText('```json\n{"lines": [{"name": "Sosa",}]}\n```');
      } catch (error) {
        capturado = error;
      }
      expect(capturado).toBeInstanceOf(ValidationError);
      expect((capturado as ValidationError).code).toBe('invalid_input');
    });

    it('"lines" no es ni lista ni null (es una cadena) -> ValidationError invalid_input', () => {
      let capturado: unknown;
      try {
        extractCatalogFromText('{"lines": "no es una lista"}');
      } catch (error) {
        capturado = error;
      }
      expect(capturado).toBeInstanceOf(ValidationError);
      expect((capturado as ValidationError).code).toBe('invalid_input');
    });
  });

  describe('R35 — cost, minPurchase y measurements.*.value viajan solo como cadena', () => {
    it('cost numerico en el JSON se trata como vacio (null)', () => {
      const texto = '{"lines":[{"name":"Sosa","cost":1250.5}]}';
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines[0]?.cost).toBeNull();
    });

    it('minPurchase numerico en el JSON se trata como vacio (null)', () => {
      const texto = '{"lines":[{"name":"Sosa","minPurchase":25}]}';
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines[0]?.minPurchase).toBeNull();
    });

    it('measurements.diameter.value numerico se trata como vacio (null)', () => {
      const texto =
        '{"lines":[{"name":"Sosa","measurements":{"diameter":{"value":7.5,"unit":"cm"}}}]}';
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines[0]?.measurements?.diameter).toEqual({ value: null, unit: 'cm' });
    });

    it('cost como cadena decimal se conserva tal cual, sin pasar por coma flotante', () => {
      const texto = '{"lines":[{"name":"Sosa","cost":"120.5000"}]}';
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines[0]?.cost).toBe('120.5000');
    });
  });

  describe('R7 — es pura: no escribe nada y su resultado es consistente', () => {
    it('llamarla dos veces con el mismo texto da el mismo resultado', () => {
      const texto = `{"lines":[${LINEA_COMPLETA}]}`;
      const primero = extractCatalogFromText(texto);
      const segundo = extractCatalogFromText(texto);
      expect(primero).toEqual(segundo);
    });

    it('no depende de ningun puerto: el modulo no importa nada de plataforma', async () => {
      const modulo = await import('@/lib/modules/documentos/domain/catalog-extraction');
      expect(typeof modulo.extractCatalogFromText).toBe('function');
      expect(Object.keys(modulo)).toContain('extractCatalogFromText');
    });
  });

  describe('QT-296 — tipo y subtipo de cada linea', () => {
    function lineaCon(campos: string): string {
      return `{"lines":[{"name":"Frasco 500","cost":"1.2000"${campos}}]}`;
    }

    it('R29 — lee type y packagingSubtype cuando son codigos validos', () => {
      const [linea] = extractCatalogFromText(
        lineaCon(',"type":"PACKAGING_MATERIAL","packagingSubtype":"CONTAINER"'),
      ).lines;
      expect(linea?.type).toBe('PACKAGING_MATERIAL');
      expect(linea?.packagingSubtype).toBe('CONTAINER');
    });

    it('R29 — RAW_MATERIAL sin subtipo se lee tal cual', () => {
      const [linea] = extractCatalogFromText(lineaCon(',"type":"RAW_MATERIAL","packagingSubtype":null')).lines;
      expect(linea?.type).toBe('RAW_MATERIAL');
      expect(linea?.packagingSubtype).toBeNull();
    });

    it.each([
      ['ausentes', ''],
      ['null', ',"type":null,"packagingSubtype":null'],
      ['un numero', ',"type":3,"packagingSubtype":2'],
      ['en minuscula o en espanol', ',"type":"packaging_material","packagingSubtype":"tapa"'],
    ])('R29 — tipo y subtipo %s quedan en null y la linea sigue con sus otros datos', (_caso, campos) => {
      const resultado = extractCatalogFromText(lineaCon(campos));
      expect(resultado.lines).toHaveLength(1);
      expect(resultado.lines[0]?.name).toBe('Frasco 500');
      expect(resultado.lines[0]?.cost).toBe('1.2000');
      expect(resultado.lines[0]?.type).toBeNull();
      expect(resultado.lines[0]?.packagingSubtype).toBeNull();
    });

    it('R29 — un subtipo «tapa» en minuscula queda null aunque el tipo sea empaque', () => {
      const [linea] = extractCatalogFromText(
        lineaCon(',"type":"PACKAGING_MATERIAL","packagingSubtype":"tapa"'),
      ).lines;
      expect(linea?.type).toBe('PACKAGING_MATERIAL');
      expect(linea?.packagingSubtype).toBeNull();
    });

    it('R29 — un tipo invalido en una linea no invalida las demas ni el documento', () => {
      const texto =
        '{"lines":[{"name":"A","type":"OTRO"},{"name":"B","type":"TOOL"}]}';
      const resultado = extractCatalogFromText(texto);
      expect(resultado.lines.map((linea) => [linea.name, linea.type])).toEqual([
        ['A', null],
        ['B', 'TOOL'],
      ]);
    });

    it('R30 — RAW_MATERIAL + CAP deja el subtipo en null y conserva el tipo', () => {
      const [linea] = extractCatalogFromText(lineaCon(',"type":"RAW_MATERIAL","packagingSubtype":"CAP"')).lines;
      expect(linea?.type).toBe('RAW_MATERIAL');
      expect(linea?.packagingSubtype).toBeNull();
    });

    it('R30 — null + CAP deja el subtipo en null sin deducir el tipo empaque', () => {
      const [linea] = extractCatalogFromText(lineaCon(',"type":null,"packagingSubtype":"CAP"')).lines;
      expect(linea?.type).toBeNull();
      expect(linea?.packagingSubtype).toBeNull();
    });

    it('R30 — un subtipo sin clave type tampoco deduce el tipo', () => {
      const [linea] = extractCatalogFromText(lineaCon(',"packagingSubtype":"MEASURER"')).lines;
      expect(linea?.type).toBeNull();
      expect(linea?.packagingSubtype).toBeNull();
    });
  });
});
