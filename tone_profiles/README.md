# Perfiles de Tono — LinkedIn Calendar

Directorio con los perfiles de escritura de cada persona del equipo.
Cada perfil documenta el estilo real de LinkedIn de esa persona para que el generador de posts lo imite con precisión.

---

## Cómo usar estos archivos

### 1. Para agregar un perfil nuevo
1. Copia `TEMPLATE.md` y renómbralo `nombre-apellido.md`
2. Llena todos los campos con los datos de la persona
3. Recopila 3-6 posts reales de LinkedIn de esa persona
4. Pégalos en la sección "Posts de referencia"

### 2. Para activar el tono en la app
1. Abre la app → pestaña **"Crea tu post"**
2. Selecciona la persona en el campo **"Autor y tono personal"**
3. Haz clic en **"✦ Adaptar tono"**
4. Copia los posts de la sección "Posts de referencia" del perfil .md
5. Pégalos en el modal y haz clic en **"Analizar y guardar"**
6. El tono queda guardado en el navegador para esa persona

> El análisis se guarda en `localStorage` del navegador — una sola vez por persona. La próxima vez que alguien use la app, si ya está guardado, aparece automáticamente.

---

## Perfiles disponibles

| Persona | Archivo | LinkedIn | Estilo | Estado |
|---------|---------|----------|--------|--------|
| Ericka Ortegón | [ericka-ortegon.md](./ericka-ortegon.md) | [Ver perfil](https://linkedin.com/in/ericka-ortegón-ayala-291129205/) | Conversacional-Profesional | ✅ Completo |
| María Juliana Hernández | [perfil-tono-maria-juliana-hernandez.md](./perfil-tono-maria-juliana-hernandez.md) | [Ver perfil](https://linkedin.com/in/mariajulianah) | Narrativo-Estratégico / Ecosistémico | ✅ Completo |
| Mafe Ramírez | [perfil-tono-mafe-ramirez.md](./perfil-tono-mafe-ramirez.md) | [Ver perfil](https://linkedin.com/in/maria-fernanda-ramirez/) | Humano-Inspiracional / Profesional-Cercano | ✅ Completo |
| Gabriela Cala | [perfil-tono-gabriela-cala.md](./perfil-tono-gabriela-cala.md) | [Ver perfil](https://linkedin.com/in/gabriela-cala/) | Conversacional-Comunitario / Estratégico-Humano | ✅ Completo |
| Alessandra Huapaya | [perfil-tono-alessandra-huapaya.md](./perfil-tono-alessandra-huapaya.md) | [Ver perfil](https://linkedin.com/in/alessandrahuapaya/) | Estratégico-Comercial / Educativo-Humano | ✅ Completo |
| César Lengua | [perfil-tono-cesar-lengua.md](./perfil-tono-cesar-lengua.md) | [Ver perfil](https://linkedin.com/in/césarlengua/) | Conversacional-Ecosistémico / Profesional-Cercano | ✅ Completo |
| Daniel Villegas | [perfil-tono-daniel-villegas.md](./perfil-tono-daniel-villegas.md) | [Ver perfil](https://linkedin.com/in/daniel-villegas-/) | Conversacional-Ecosistémico / Profesional-Cercano | ✅ Completo |
| Mariangel | _pendiente_ | — | — | ⏳ |
| Manuela Peña | _pendiente_ | — | — | ⏳ |
| Daniel Bilbao | _pendiente_ | — | — | ⏳ |
| Lony Milena | _pendiente_ | — | — | ⏳ |
| Christian Rojas | _pendiente_ | — | — | ⏳ |

---

## Estructura de un perfil

```
tone_profiles/
├── README.md                                ← Este archivo (índice)
├── TEMPLATE.md                              ← Plantilla vacía para copiar
├── ericka-ortegon.md                        ← ✅ Ericka Ortegón
├── perfil-tono-maria-juliana-hernandez.md   ← ✅ María Juliana Hernández
├── perfil-tono-mafe-ramirez.md              ← ✅ Mafe Ramírez
├── perfil-tono-gabriela-cala.md             ← ✅ Gabriela Cala
├── perfil-tono-alessandra-huapaya.md        ← ✅ Alessandra Huapaya
├── perfil-tono-cesar-lengua.md              ← ✅ César Lengua
├── perfil-tono-daniel-villegas.md           ← ✅ Daniel Villegas
├── perfil-tono-mariangel.md                 ← ⏳ pendiente
├── perfil-tono-manuela-pena.md              ← ⏳ pendiente
├── perfil-tono-daniel-bilbao.md             ← ⏳ pendiente
├── perfil-tono-lony-milena.md               ← ⏳ pendiente
└── perfil-tono-christian-rojas.md           ← ⏳ pendiente
```

---

## Convenciones de naming

- Archivo: `nombre-apellido.md` (todo minúsculas, sin tildes, guión como separador)
- Nombre en el JSON: debe coincidir **exactamente** con el nombre en la lista de personas de la app (`PEOPLE` array en `page.tsx`)
- Estilo: usa siempre uno de los 4 valores válidos: `conversacional`, `profesional`, `inspiracional`, `educativo`
