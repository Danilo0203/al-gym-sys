import assert from "node:assert/strict";
import test from "node:test";
import { exerciseNameFromFile, prepareExerciseBatch, uploadExerciseBatch, validateExerciseBatch } from "./exercise-batch";

function media(name: string, type = "image/gif", size = 3) {
  return new File([new Uint8Array(size)], name, { type });
}

test("usa el nombre exacto sin extensión y conserva rutas de subcarpetas y tipos faltantes de Windows", () => {
  assert.equal(exerciseNameFromFile("Piernas/Sentadilla_búlgara.v2.GIF"), "Sentadilla_búlgara.v2");
  assert.equal(exerciseNameFromFile("C:\\Fotos\\Press de banca.mp4"), "Press de banca");
  const image = media("Sentadilla.GIF", "");
  Object.defineProperty(image, "webkitRelativePath", { value: "Ejercicios/Piernas/Sentadilla.GIF" });
  const [item, video] = prepareExerciseBatch([image, media("Press.MP4", "")]);
  assert.equal(item.name, "Sentadilla");
  assert.equal(item.path, "Ejercicios/Piernas/Sentadilla.GIF");
  assert.equal(item.file.type, "image/gif");
  assert.equal(video.file.type, "video/mp4");
});

test("señala duplicados, nombres inválidos, archivos ajenos y límites; permite corregir el nombre", () => {
  const items = prepareExerciseBatch([
    media("Sentadilla.gif"), media("SENTADILLA.mp4", "video/mp4"), media("Press.gif"),
    media("a.gif"), media("notas.txt", "text/plain"), media("Grande.gif", "image/gif", 5 * 1024 * 1024 + 1),
    media("Video.mp4", "video/mp4", 20 * 1024 * 1024 + 1), media("Vacio.gif", "image/gif", 0),
  ]);
  const errors = validateExerciseBatch(items, [" press "]);
  assert.equal(errors.size, 7);
  assert.equal(errors.has(items[0].id), false);
  assert.match(errors.get(items[1].id)!, /Ya existe/);
  assert.match(errors.get(items[5].id)!, /5 MB/);
  assert.match(errors.get(items[6].id)!, /20 MB/);
  items[1].name = "Sentadilla con barra";
  assert.equal(validateExerciseBatch(items, ["Press"]).has(items[1].id), false);
});

test("un archivo rechazado no bloquea otro válido del mismo nombre; los guardados no se repiten", () => {
  const items = prepareExerciseBatch([media("Press.txt", "text/plain"), media("Press.gif")]);
  assert.equal(validateExerciseBatch(items, []).has(items[1].id), false);
  items[1].status = "success";
  const [again] = prepareExerciseBatch([media("press.mp4", "video/mp4")]);
  assert.match(validateExerciseBatch([...items, again], []).get(again.id)!, /Ya existe/);
});

test("sube más de 100 archivos uno por uno, preserva nombres/bytes y continúa tras fallos", async () => {
  const items = prepareExerciseBatch(Array.from({ length: 125 }, (_, index) => media(`Ejercicio ${index}.gif`)));
  let active = 0;
  let processed = 0;
  const statuses = new Map<string, string>();
  const result = await uploadExerciseBatch(items, async (data) => {
    assert.equal(++active, 1);
    const current = processed++;
    assert.equal(data.get("name"), `Ejercicio ${current}`);
    const file = data.get("image") as File;
    assert.equal(file.name, `Ejercicio ${current}.gif`);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array(3));
    active--;
    if (current === 2) throw new Error("Sin conexión");
    return current === 3 ? { success: false, error: "Archivo inválido" } : { success: true };
  }, (id, status) => statuses.set(id, status), () => false);
  assert.deepEqual(result, { saved: 123, failed: 2 });
  assert.equal(statuses.get(items[2].id), "error");
  assert.equal(statuses.get(items[124].id), "success");
});

test("detener finaliza el archivo actual y deja los demás pendientes", async () => {
  const items = prepareExerciseBatch([media("Uno.gif"), media("Dos.gif"), media("Tres.gif")]);
  let stopped = false;
  const result = await uploadExerciseBatch(items, async () => {
    stopped = true;
    return { success: true };
  }, (id, status) => { items.find((item) => item.id === id)!.status = status; }, () => stopped);
  assert.deepEqual(result, { saved: 1, failed: 0 });
  assert.deepEqual(items.map((item) => item.status), ["success", "pending", "pending"]);
});
