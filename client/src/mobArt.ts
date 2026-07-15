import Phaser from "phaser";

// Procedural monster figures — one bespoke silhouette per kind, built from
// shapes at spawn. Returns the container plus the "body" shape used for
// hit-flash/pops and its base color for restoring after the flash.

export interface MonsterFigure {
  figure: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Shape;
  baseColor: number;
  anims: Phaser.Tweens.Tween[]; // idle life — killed when the monster dies
}

export function buildMonsterFigure(scene: Phaser.Scene, kind: string): MonsterFigure {
  const fig = scene.add.container(0, 0);
  let body: Phaser.GameObjects.Shape;
  let baseColor: number;
  const anims: Phaser.Tweens.Tween[] = [];
  const jitter = Math.random() * 300; // desync the herd

  switch (kind) {
    case "imp": {
      // a small red imp with a crude blade — brave in packs, craven alone
      baseColor = 0xb84a30;
      const legL = scene.add.rectangle(-2, -3, 2.5, 6, 0x7a2c1a);
      const legR = scene.add.rectangle(2, -3, 2.5, 6, 0x7a2c1a);
      body = scene.add.ellipse(0, -9, 10, 9, baseColor);
      body.setStrokeStyle(1, 0x5f2010, 0.9);
      const head = scene.add.circle(0, -16, 3.8, 0xc85838);
      head.setStrokeStyle(1, 0x5f2010, 0.8);
      const earL = scene.add.triangle(-4, -19, 0, 4, -3, -3, 2, 1, 0xb84a30);
      const earR = scene.add.triangle(4, -19, 0, 4, 3, -3, -2, 1, 0xb84a30);
      const eyeL = scene.add.circle(-1.4, -16.5, 0.9, 0xffe040);
      const eyeR = scene.add.circle(1.4, -16.5, 0.9, 0xffe040);
      const blade = scene.add.rectangle(6, -10, 2, 9, 0x8a8274).setRotation(0.6); // a scavenged shiv
      fig.add([legL, legR, blade, body, head, earL, earR, eyeL, eyeR]);
      // constant nervous hopping — it KNOWS it should run
      anims.push(scene.tweens.add({ targets: [body, head, earL, earR, eyeL, eyeR], y: "-=1.6", duration: 240 + jitter / 3, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: blade, rotation: "+=0.3", duration: 480 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "spineback": {
      // a low spined rodent that spits its own back at you
      baseColor = 0x8a6a42;
      body = scene.add.ellipse(0, -7, 15, 9, baseColor);
      body.setStrokeStyle(1, 0x4f3a20, 0.9);
      const quills: Phaser.GameObjects.Shape[] = [];
      for (let i = 0; i < 6; i++) {
        const a = -0.5 - i * 0.35;
        const q = scene.add.rectangle(Math.cos(a) * 6, -9 + Math.sin(a) * 4, 9, 1.4, 0x5a4428).setRotation(a);
        quills.push(q);
      }
      const head = scene.add.ellipse(7, -6, 6, 5, 0x9a7a4e);
      head.setStrokeStyle(1, 0x4f3a20, 0.8);
      const nose = scene.add.circle(10, -6, 1.2, 0x2c2018);
      const eye = scene.add.circle(7.5, -7.5, 0.9, 0xd03030);
      const tail = scene.add.rectangle(-8, -5, 6, 1.5, 0x6a5232).setRotation(-0.3);
      fig.add([...quills, tail, body, head, nose, eye]);
      // hackles rise and fall
      anims.push(scene.tweens.add({ targets: quills, scaleX: 1.25, duration: 700 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: tail, rotation: "+=0.4", duration: 500 + jitter / 2, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "zombie": {
      baseColor = 0x6b8f4e;
      const legs = scene.add.rectangle(0, -4, 8, 7, 0x3d4a2c);
      const armB = scene.add.rectangle(6, -10, 9, 3, 0x4a6234).setRotation(0.5);
      body = scene.add.ellipse(0, -12, 14, 13, baseColor).setRotation(0.18);
      body.setStrokeStyle(1, 0x2f3d22, 0.9);
      const head = scene.add.circle(5, -19, 4.5, 0x7fa05e);
      head.setStrokeStyle(1, 0x2f3d22, 0.7);
      const eye = scene.add.circle(6.5, -20, 1.1, 0xd03030);
      const armF = scene.add.rectangle(10, -14, 10, 3, 0x55703c).setRotation(0.22);
      fig.add([legs, armB, body, head, eye, armF]);
      // the dead reach, endlessly
      anims.push(scene.tweens.add({ targets: [armF, armB], rotation: "+=0.28", duration: 950 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "skeleton":
    case "archer": {
      baseColor = 0xd8d4c0;
      const legL = scene.add.rectangle(-2, -4, 2.5, 8, 0xb8b4a0);
      const legR = scene.add.rectangle(2, -4, 2.5, 8, 0xb8b4a0);
      body = scene.add.rectangle(0, -13, 9, 11, baseColor);
      body.setStrokeStyle(1, 0x6a675a, 0.8);
      const rib1 = scene.add.rectangle(0, -15, 8, 1, 0x9a968a);
      const rib2 = scene.add.rectangle(0, -12, 8, 1, 0x9a968a);
      const skull = scene.add.circle(0, -22, 4, 0xe8e4d4);
      skull.setStrokeStyle(1, 0x6a675a, 0.7);
      const eyeL = scene.add.circle(-1.6, -22.5, 0.9, 0x22242a);
      const eyeR = scene.add.circle(1.6, -22.5, 0.9, 0x22242a);
      fig.add([legL, legR, body, rib1, rib2, skull, eyeL, eyeR]);
      if (kind === "archer") {
        const bow = scene.add.arc(8, -14, 8, -80, 80, false, 0x000000, 0);
        bow.setStrokeStyle(2, 0x7a5a34, 0.95);
        const quiver = scene.add.rectangle(-6, -16, 3, 9, 0x5f482e).setRotation(-0.35);
        fig.add([quiver, bow]);
        anims.push(scene.tweens.add({ targets: bow, y: "-=1.5", duration: 800 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      } else {
        const blade = scene.add.rectangle(8, -14, 2.5, 12, 0x9a9284).setRotation(0.5); // rusty sword
        fig.add(blade);
        anims.push(scene.tweens.add({ targets: blade, rotation: "+=0.15", duration: 1100 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      }
      // old bones never sit still
      anims.push(scene.tweens.add({ targets: skull, x: "+=0.9", duration: 80, yoyo: true, repeat: -1, repeatDelay: 1400 + jitter * 3, ease: "sine.inout" }));
      break;
    }

    case "bovine":
    case "bovax": {
      // a hell bovine: bipedal, unimpressed, armed
      const king = kind === "bovax";
      const s = king ? 1.5 : 1;
      baseColor = 0xe8e4dc;
      const legL = scene.add.rectangle(-3 * s, -4, 3.5 * s, 8 * s, 0x3a342c);
      const legR = scene.add.rectangle(3 * s, -4, 3.5 * s, 8 * s, 0x3a342c);
      body = scene.add.ellipse(0, -13 * s, 16 * s, 14 * s, baseColor);
      body.setStrokeStyle(1, 0x4a443a, 0.9);
      const patch1 = scene.add.ellipse(-3 * s, -15 * s, 6 * s, 5 * s, 0x2a2620);
      const patch2 = scene.add.ellipse(4 * s, -10 * s, 5 * s, 4 * s, 0x2a2620);
      const head = scene.add.ellipse(0, -23 * s, 9 * s, 7.5 * s, 0xd8d4cc);
      head.setStrokeStyle(1, 0x4a443a, 0.8);
      const snout = scene.add.ellipse(0, -21 * s, 5 * s, 3.5 * s, 0xc09a9a);
      const hornL = scene.add.triangle(-6 * s, -27 * s, 0, 5, -4, -4, 3, 2, 0xf0ead8);
      const hornR = scene.add.triangle(6 * s, -27 * s, 0, 5, 4, -4, -3, 2, 0xf0ead8);
      const eyeL = scene.add.circle(-2.4 * s, -24 * s, 1 * s, king ? 0xff3020 : 0x22242a);
      const eyeR = scene.add.circle(2.4 * s, -24 * s, 1 * s, king ? 0xff3020 : 0x22242a);
      // the traditional polearm
      const shaft = scene.add.rectangle(9 * s, -14 * s, 2.5, 24 * s, 0x6a4a2c).setRotation(0.15);
      const blade = scene.add.triangle(11 * s, -26 * s, 0, 8, -4, -4, 5, -2, 0xb8bcc8);
      const tail = scene.add.rectangle(-9 * s, -10 * s, 2, 9 * s, 0x4a443a).setRotation(0.3);
      fig.add([tail, legL, legR, shaft, blade, body, patch1, patch2, head, snout, hornL, hornR, eyeL, eyeR]);
      // tail swish, jaw working on something
      anims.push(scene.tweens.add({ targets: tail, rotation: "-=0.5", duration: 600 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: snout, y: "+=1", duration: 350 + jitter / 2, yoyo: true, repeat: -1, ease: "sine.inout" }));
      if (king) {
        const crown = scene.add.polygon(0, -30 * s, [-5, 2, -5, -3, -2, 0, 0, -4, 2, 0, 5, -3, 5, 2], 0xd8b13a);
        crown.setStrokeStyle(1, 0x8a6a1a, 0.9);
        fig.add(crown);
      }
      break;
    }

    case "demon": {
      baseColor = 0x7a2a9f;
      const legs = scene.add.rectangle(0, -4, 12, 8, 0x3d1a4f);
      body = scene.add.ellipse(0, -15, 20, 17, baseColor);
      body.setStrokeStyle(1, 0x2a0f38, 0.9);
      const head = scene.add.circle(0, -26, 5.5, 0x8f3aaf);
      const hornL = scene.add.triangle(-5, -31, 0, 6, -3, -6, 3, 2, 0xd8d4c0);
      const hornR = scene.add.triangle(5, -31, 0, 6, 3, -6, -3, 2, 0xd8d4c0);
      const eyeL = scene.add.circle(-2, -26.5, 1.2, 0xff5030);
      const eyeR = scene.add.circle(2, -26.5, 1.2, 0xff5030);
      const clawL = scene.add.rectangle(-11, -13, 6, 3.5, 0x5a1f78).setRotation(-0.4);
      const clawR = scene.add.rectangle(11, -13, 6, 3.5, 0x5a1f78).setRotation(0.4);
      fig.add([legs, clawL, clawR, body, head, hornL, hornR, eyeL, eyeR]);
      // claws flex, eager
      anims.push(scene.tweens.add({ targets: [clawL, clawR], rotation: "+=0.18", duration: 700 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "cultist": {
      // a robed zealot, hood too deep, hands full of hex-light
      baseColor = 0x4a3358;
      body = scene.add.triangle(0, -9, -7, 8, 7, 8, 0, -14, baseColor);
      body.setStrokeStyle(1, 0x2c1c36, 0.9);
      const hood = scene.add.circle(0, -19, 4.2, 0x3a2846);
      hood.setStrokeStyle(1, 0x241630, 0.8);
      const dark = scene.add.ellipse(0, -18.4, 5, 3.4, 0x0c0810); // no face in there
      const handL = scene.add.circle(-6, -12, 1.8, 0xc8a8d8);
      const handR = scene.add.circle(6, -12, 1.8, 0xc8a8d8);
      const spark = scene.add.circle(6, -14, 1.1, 0xd88aff);
      fig.add([body, hood, dark, handL, handR, spark]);
      anims.push(scene.tweens.add({ targets: spark, y: "-=3", alpha: 0.4, duration: 520 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: [handL, handR], y: "-=1.4", duration: 780 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "goatman": {
      // a goatman: horns, hooves, and a very bad temper
      baseColor = 0x6a4a32;
      const legL = scene.add.rectangle(-3, -3, 3, 7, 0x3d2a1a);
      const legR = scene.add.rectangle(3, -3, 3, 7, 0x3d2a1a);
      body = scene.add.ellipse(0, -12, 13, 12, baseColor);
      body.setStrokeStyle(1, 0x3d2a1a, 0.9);
      const mane = scene.add.ellipse(0, -16, 10, 6, 0x4f3622);
      const head = scene.add.ellipse(0, -21, 7, 6.5, 0x7a5a3e);
      head.setStrokeStyle(1, 0x3d2a1a, 0.8);
      const snout = scene.add.ellipse(0, -19, 4, 2.6, 0x9a7a56);
      const hornL = scene.add.triangle(-5, -26, 0, 5, -4, -5, 2, 1, 0xd8ccae);
      const hornR = scene.add.triangle(5, -26, 0, 5, 4, -5, -2, 1, 0xd8ccae);
      const eyeL = scene.add.circle(-2, -22, 0.9, 0xffd040);
      const eyeR = scene.add.circle(2, -22, 0.9, 0xffd040);
      const axe = scene.add.rectangle(8, -13, 2.5, 13, 0x5a4428).setRotation(0.4);
      const axeHead = scene.add.triangle(11, -19, 0, 6, -5, -2, 4, -3, 0x9a9284);
      fig.add([legL, legR, axe, axeHead, body, mane, head, snout, hornL, hornR, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: [head, snout, hornL, hornR, eyeL, eyeR], y: "-=1.4", duration: 420 + jitter / 2, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: [axe, axeHead], rotation: "+=0.2", duration: 640 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "wraith": {
      // a torn shroud with nothing inside — it drifts, it does not walk
      baseColor = 0x8aa8c8;
      body = scene.add.triangle(0, -10, -8, 10, 8, 10, 0, -16, baseColor);
      body.setStrokeStyle(1, 0x4a6888, 0.6);
      (body as Phaser.GameObjects.Triangle).setAlpha(0.75);
      const head = scene.add.circle(0, -20, 4, 0xaac4de).setAlpha(0.85);
      const eyeL = scene.add.circle(-1.6, -20.5, 1, 0x40e8ff);
      const eyeR = scene.add.circle(1.6, -20.5, 1, 0x40e8ff);
      const tatter1 = scene.add.triangle(-5, -3, 0, 6, -3, -3, 3, -1, 0x7a98b8).setAlpha(0.6);
      const tatter2 = scene.add.triangle(4, -2, 0, 7, -3, -2, 3, -3, 0x7a98b8).setAlpha(0.6);
      fig.add([tatter1, tatter2, body, head, eyeL, eyeR]);
      // it hovers — everything about it hovers
      anims.push(scene.tweens.add({ targets: [body, head, eyeL, eyeR, tatter1, tatter2], y: "-=3.5", duration: 900 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: [tatter1, tatter2], rotation: "+=0.3", duration: 700 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "gargoyle": {
      // animate masonry: wings of stone, patience of stone
      baseColor = 0x6a6a74;
      const legs = scene.add.rectangle(0, -3, 10, 6, 0x4a4a54);
      const wingL = scene.add.triangle(-9, -16, 0, 8, -8, -6, 3, -2, 0x55555f);
      const wingR = scene.add.triangle(9, -16, 0, 8, 8, -6, -3, -2, 0x55555f);
      body = scene.add.ellipse(0, -12, 15, 13, baseColor);
      body.setStrokeStyle(1.5, 0x3a3a44, 0.9);
      const head = scene.add.ellipse(0, -21, 8, 6.5, 0x7a7a84);
      head.setStrokeStyle(1, 0x3a3a44, 0.8);
      const hornL = scene.add.triangle(-4, -25, 0, 4, -3, -4, 2, 1, 0x8a8a94);
      const hornR = scene.add.triangle(4, -25, 0, 4, 3, -4, -2, 1, 0x8a8a94);
      const eyeL = scene.add.circle(-2, -21, 1, 0xff8030);
      const eyeR = scene.add.circle(2, -21, 1, 0xff8030);
      fig.add([legs, wingL, wingR, body, head, hornL, hornR, eyeL, eyeR]);
      // slow wing flex — stone remembering how to fly
      anims.push(scene.tweens.add({ targets: wingL, rotation: "-=0.22", duration: 1200 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: wingR, rotation: "+=0.22", duration: 1200 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "succubus": {
      // graceful and entirely uninterested in your survival
      baseColor = 0xb84a68;
      const legL = scene.add.rectangle(-2, -3, 2.5, 7, 0x6a2438);
      const legR = scene.add.rectangle(2, -3, 2.5, 7, 0x6a2438);
      body = scene.add.triangle(0, -11, -6, 8, 6, 8, 0, -12, baseColor);
      body.setStrokeStyle(1, 0x6a2438, 0.9);
      const wingL = scene.add.triangle(-8, -16, 0, 7, -7, -5, 3, -2, 0x8a3450).setAlpha(0.85);
      const wingR = scene.add.triangle(8, -16, 0, 7, 7, -5, -3, -2, 0x8a3450).setAlpha(0.85);
      const head = scene.add.circle(0, -20, 4, 0xe8b8a8);
      head.setStrokeStyle(1, 0x6a2438, 0.7);
      const hair = scene.add.ellipse(0, -23, 8, 4, 0x2c1420);
      const eyeL = scene.add.circle(-1.5, -20.4, 0.8, 0xff3860);
      const eyeR = scene.add.circle(1.5, -20.4, 0.8, 0xff3860);
      const star = scene.add.circle(7, -14, 1.6, 0xff5878);
      fig.add([legL, legR, wingL, wingR, body, head, hair, eyeL, eyeR, star]);
      anims.push(scene.tweens.add({ targets: [wingL, wingR], scaleY: 1.2, duration: 640 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: star, y: "-=3", alpha: 0.4, duration: 500 + jitter / 2, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "hellion": {
      // a furnace with shoulders
      baseColor = 0x8a2818;
      const legs = scene.add.rectangle(0, -4, 13, 8, 0x4a1408);
      const wingL = scene.add.triangle(-11, -18, 0, 10, -9, -8, 4, -2, 0x3a1008);
      const wingR = scene.add.triangle(11, -18, 0, 10, 9, -8, -4, -2, 0x3a1008);
      body = scene.add.ellipse(0, -14, 18, 16, baseColor);
      body.setStrokeStyle(1.5, 0x4a1408, 0.9);
      const chest = scene.add.ellipse(0, -13, 9, 8, 0xff6020).setAlpha(0.5); // the furnace door
      const head = scene.add.ellipse(0, -25, 9, 7.5, 0x9a3820);
      head.setStrokeStyle(1, 0x4a1408, 0.8);
      const hornL = scene.add.triangle(-6, -30, 0, 6, -5, -6, 3, 1, 0x2c1810);
      const hornR = scene.add.triangle(6, -30, 0, 6, 5, -6, -3, 1, 0x2c1810);
      const eyeL = scene.add.circle(-2.5, -26, 1.2, 0xffd040);
      const eyeR = scene.add.circle(2.5, -26, 1.2, 0xffd040);
      const whip = scene.add.rectangle(11, -12, 2, 16, 0xff5810).setRotation(0.5).setAlpha(0.9);
      fig.add([legs, wingL, wingR, whip, body, chest, head, hornL, hornR, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: chest, alpha: 0.85, duration: 480 + jitter / 2, yoyo: true, repeat: -1 })); // it breathes fire IN
      anims.push(scene.tweens.add({ targets: whip, rotation: "+=0.35", duration: 560 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "goblin": {
      baseColor = 0xd8b13a;
      const sack = scene.add.circle(-6, -14, 7, 0x7a5a34);
      sack.setStrokeStyle(1, 0x54402a, 0.9);
      const coin = scene.add.circle(-4, -19, 1.6, 0xffd54a);
      const legs = scene.add.rectangle(0, -3, 7, 5, 0x54502c);
      body = scene.add.ellipse(2, -9, 10, 9, 0x8f8f3a);
      const head = scene.add.circle(5, -14, 3.5, 0xa0a04a);
      const ear = scene.add.triangle(8, -16, 0, 3, 4, -2, -1, -2, 0xa0a04a);
      const eye = scene.add.circle(6, -14.5, 0.9, 0x22242a);
      fig.add([sack, coin, legs, body, head, ear, eye]);
      // the sack of treasure jiggles as it fidgets
      anims.push(scene.tweens.add({ targets: [sack, coin], y: "-=1.5", duration: 260 + jitter / 3, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: ear, rotation: "+=0.3", duration: 120, yoyo: true, repeat: -1, repeatDelay: 900 + jitter * 2 }));
      break;
    }

    case "flenser": {
      baseColor = 0x9e2b25;
      const legs = scene.add.rectangle(0, -5, 16, 10, 0x4a1512);
      body = scene.add.ellipse(0, -19, 26, 22, baseColor);
      body.setStrokeStyle(2, 0x3d0f0c, 0.9);
      const apron = scene.add.rectangle(0, -16, 12, 16, 0x6a4a3a);
      const head = scene.add.circle(0, -33, 6, 0xb04038);
      const eyeL = scene.add.circle(-2.2, -33.5, 1.2, 0xffe060);
      const eyeR = scene.add.circle(2.2, -33.5, 1.2, 0xffe060);
      const cleaverBlade = scene.add.rectangle(15, -22, 9, 13, 0xc8ccd4).setRotation(0.25);
      const cleaverHandle = scene.add.rectangle(13, -12, 3, 9, 0x54402a).setRotation(0.25);
      fig.add([legs, body, apron, head, eyeL, eyeR, cleaverHandle, cleaverBlade]);
      // the cleaver twitches — he's deciding which cut you are
      anims.push(scene.tweens.add({ targets: [cleaverBlade, cleaverHandle], rotation: "+=0.14", duration: 500 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "corvessa": {
      baseColor = 0x5f2438;
      const legs = scene.add.rectangle(0, -4, 8, 7, 0x2f1220);
      body = scene.add.ellipse(0, -14, 12, 15, baseColor);
      body.setStrokeStyle(1, 0x2f1220, 0.9);
      const hood = scene.add.triangle(0, -25, 0, -7, 6, 5, -6, 5, 0x3d1826);
      const eyeL = scene.add.circle(-1.8, -23, 1, 0xff4040);
      const eyeR = scene.add.circle(1.8, -23, 1, 0xff4040);
      const bow = scene.add.arc(9, -15, 10, -80, 80, false, 0x000000, 0);
      bow.setStrokeStyle(2, 0x54402a, 0.95);
      fig.add([legs, body, hood, eyeL, eyeR, bow]);
      anims.push(scene.tweens.add({ targets: bow, y: "-=2", duration: 700 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: [eyeL, eyeR], alpha: 0.4, duration: 500, yoyo: true, repeat: -1, delay: jitter }));
      break;
    }

    case "maggotqueen": {
      baseColor = 0xb8b06a;
      const segB = scene.add.ellipse(-10, -10, 18, 14, 0xa89e5c);
      const segM = scene.add.ellipse(0, -12, 22, 17, baseColor);
      body = segM;
      body.setStrokeStyle(1, 0x6a643a, 0.8);
      const segF = scene.add.ellipse(10, -11, 16, 13, 0xc8c07a);
      const head = scene.add.circle(17, -14, 5, 0xd8d08a);
      const eyeL = scene.add.circle(16, -16, 1.1, 0x501818);
      const eyeR = scene.add.circle(19, -15, 1.1, 0x501818);
      const eggA = scene.add.circle(-14, -4, 3, 0xdcd6a8, 0.85);
      const eggB = scene.add.circle(-6, -2, 2.4, 0xdcd6a8, 0.85);
      fig.add([eggA, eggB, segB, segM, segF, head, eyeL, eyeR]);
      // segments writhe out of phase — deeply unpleasant, exactly right
      anims.push(scene.tweens.add({ targets: segF, scaleX: 1.08, scaleY: 0.94, duration: 520 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: segB, scaleX: 1.08, scaleY: 0.94, duration: 520 + jitter, yoyo: true, repeat: -1, ease: "sine.inout", delay: 260 }));
      anims.push(scene.tweens.add({ targets: [eggA, eggB], scaleX: 1.15, scaleY: 1.15, duration: 900 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "malgrim": {
      baseColor = 0xd83a2a;
      const legs = scene.add.rectangle(0, -5, 16, 10, 0x5a1210);
      const tail = scene.add.rectangle(-12, -8, 12, 4, 0x8f2018).setRotation(-0.5);
      body = scene.add.ellipse(0, -20, 26, 24, baseColor);
      body.setStrokeStyle(2, 0x5a1210, 0.9);
      const spikeL = scene.add.triangle(-8, -32, 0, 6, -3, -8, 4, 2, 0x8f2018);
      const spikeR = scene.add.triangle(8, -32, 0, 6, 3, -8, -4, 2, 0x8f2018);
      const head = scene.add.circle(0, -34, 6.5, 0xe85030);
      const hornL = scene.add.triangle(-6, -40, 0, 7, -5, -8, 4, 3, 0xd8d4c0);
      const hornR = scene.add.triangle(6, -40, 0, 7, 5, -8, -4, 3, 0xd8d4c0);
      const eyeL = scene.add.circle(-2.4, -34.5, 1.4, 0xffe060);
      const eyeR = scene.add.circle(2.4, -34.5, 1.4, 0xffe060);
      fig.add([tail, legs, body, spikeL, spikeR, head, hornL, hornR, eyeL, eyeR]);
      // the tail lashes; the eyes never blink
      anims.push(scene.tweens.add({ targets: tail, rotation: "-=0.35", duration: 800 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: [eyeL, eyeR], alpha: 0.5, duration: 400, yoyo: true, repeat: -1, delay: jitter }));
      break;
    }

    case "vessira": {
      // the The Thorned Maiden: pale, spidered, crowned in spines
      baseColor = 0xb87a9a;
      const legs = scene.add.rectangle(0, -4, 10, 8, 0x4a2438);
      body = scene.add.ellipse(0, -16, 15, 18, baseColor);
      body.setStrokeStyle(1, 0x5a2a44, 0.9);
      const head = scene.add.circle(0, -28, 5, 0xd8a8c0);
      const spineL = scene.add.triangle(-6, -30, 0, 6, -4, -6, 3, 2, 0x4a2438);
      const spineR = scene.add.triangle(6, -30, 0, 6, 4, -6, -3, 2, 0x4a2438);
      const eyeL = scene.add.circle(-2, -28.5, 1.1, 0x5fae3f);
      const eyeR = scene.add.circle(2, -28.5, 1.1, 0x5fae3f);
      const clawL = scene.add.rectangle(-10, -18, 8, 3, 0x8a5a74).setRotation(-0.5);
      const clawR = scene.add.rectangle(10, -18, 8, 3, 0x8a5a74).setRotation(0.5);
      fig.add([legs, clawL, clawR, body, head, spineL, spineR, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: [clawL, clawR], rotation: "+=0.2", duration: 600 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "vuruk": {
      // the The White Maw: a wall of chitin and mandibles
      baseColor = 0xc8b88a;
      const legs = scene.add.rectangle(0, -5, 18, 10, 0x6a5a3a);
      body = scene.add.ellipse(0, -20, 28, 24, baseColor);
      body.setStrokeStyle(2, 0x6a5a3a, 0.9);
      const plate = scene.add.ellipse(0, -24, 20, 12, 0xd8cca0);
      const head = scene.add.circle(0, -34, 6, 0xb8a878);
      const mandL = scene.add.triangle(-5, -36, 0, 6, -4, -5, 3, 2, 0xf0ead8);
      const mandR = scene.add.triangle(5, -36, 0, 6, 4, -5, -3, 2, 0xf0ead8);
      const eyeL = scene.add.circle(-2.4, -34.5, 1.3, 0x8ad0ff);
      const eyeR = scene.add.circle(2.4, -34.5, 1.3, 0x8ad0ff);
      fig.add([legs, body, plate, head, mandL, mandR, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: [mandL, mandR], rotation: "+=0.25", duration: 350 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "orvath": {
      // the Lord of Hatred: a floating spectre trailing rags
      baseColor = 0x4a8a9a;
      const trail = scene.add.triangle(0, -4, 0, 8, 8, -6, -8, -6, 0x2a4a54);
      body = scene.add.ellipse(0, -16, 14, 18, baseColor);
      body.setStrokeStyle(1, 0x1d3a42, 0.9);
      const skull = scene.add.circle(0, -28, 5.5, 0x9ac8d4);
      const hornL = scene.add.triangle(-5, -33, 0, 6, -4, -6, 3, 2, 0xd8d4c0);
      const hornR = scene.add.triangle(5, -33, 0, 6, 4, -6, -3, 2, 0xd8d4c0);
      const eyeL = scene.add.circle(-2, -28.5, 1.2, 0xcdefff);
      const eyeR = scene.add.circle(2, -28.5, 1.2, 0xcdefff);
      fig.add([trail, body, skull, hornL, hornR, eyeL, eyeR]);
      // he floats — the whole spectre drifts
      anims.push(scene.tweens.add({ targets: fig, y: "-=3", duration: 900 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "aldric": {
      // the Fallen: a broken angel, wings of ice
      baseColor = 0x7a9ab8;
      const wingL = scene.add.triangle(-10, -22, 0, 10, -10, -8, 2, -2, 0xb8d0e8).setAlpha(0.7);
      const wingR = scene.add.triangle(10, -22, 0, 10, 10, -8, -2, -2, 0xb8d0e8).setAlpha(0.7);
      const legs = scene.add.rectangle(0, -5, 14, 9, 0x3a4a5c);
      body = scene.add.ellipse(0, -19, 22, 20, baseColor);
      body.setStrokeStyle(2, 0x3a4a5c, 0.9);
      const head = scene.add.circle(0, -32, 5.5, 0x9ab8d0);
      const eyeL = scene.add.circle(-2, -32.5, 1.2, 0xcdefff);
      const eyeR = scene.add.circle(2, -32.5, 1.2, 0xcdefff);
      fig.add([wingL, wingR, legs, body, head, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: [wingL, wingR], scaleY: 1.15, duration: 700 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "uldrath": {
      // the Lord of Destruction: tendrils, spikes, and a grin
      baseColor = 0xa84a3a;
      const tendL = scene.add.rectangle(-12, -10, 10, 3.5, 0x6a2a20).setRotation(-0.6);
      const tendR = scene.add.rectangle(12, -10, 10, 3.5, 0x6a2a20).setRotation(0.6);
      const legs = scene.add.rectangle(0, -5, 16, 10, 0x5a2018);
      body = scene.add.ellipse(0, -20, 26, 24, baseColor);
      body.setStrokeStyle(2, 0x5a2018, 0.9);
      const spikeL = scene.add.triangle(-8, -33, 0, 6, -3, -8, 4, 2, 0xd8ccb0);
      const spikeR = scene.add.triangle(8, -33, 0, 6, 3, -8, -4, 2, 0xd8ccb0);
      const head = scene.add.circle(0, -35, 6.5, 0xc86a4a);
      const eyeL = scene.add.circle(-2.4, -35.5, 1.4, 0xffe060);
      const eyeR = scene.add.circle(2.4, -35.5, 1.4, 0xffe060);
      const grin = scene.add.rectangle(0, -32, 7, 1.5, 0x2a1008);
      fig.add([tendL, tendR, legs, body, spikeL, spikeR, head, eyeL, eyeR, grin]);
      anims.push(scene.tweens.add({ targets: [tendL, tendR], rotation: "+=0.4", duration: 800 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "scarab": {
      // sun-beetles: lacquered shells that never stop clicking
      baseColor = 0x8a6a2a;
      const shell = scene.add.ellipse(0, -8, 15, 11, baseColor);
      shell.setStrokeStyle(1.5, 0x4a3812, 0.9);
      const seam = scene.add.rectangle(0, -8, 1.2, 10, 0x4a3812);
      const head = scene.add.circle(0, -14, 3, 0x6a5220);
      const eyeL = scene.add.circle(-1.4, -14.5, 0.9, 0xffd54a);
      const eyeR = scene.add.circle(1.4, -14.5, 0.9, 0xffd54a);
      const legL = scene.add.rectangle(-8, -6, 5, 1.2, 0x4a3812).setRotation(0.5);
      const legR = scene.add.rectangle(8, -6, 5, 1.2, 0x4a3812).setRotation(-0.5);
      body = shell;
      fig.add([legL, legR, shell, seam, head, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: [legL, legR], rotation: "+=0.4", duration: 160 + jitter * 0.2, yoyo: true, repeat: -1 }));
      break;
    }

    case "sandserpent": {
      // a coil of scale and patience, spitting from the dune shadows
      baseColor = 0xa88a4a;
      const coil1 = scene.add.ellipse(0, -5, 18, 8, baseColor).setStrokeStyle(1.5, 0x5c4a22);
      const coil2 = scene.add.ellipse(2, -11, 13, 7, 0xb89a5a).setStrokeStyle(1, 0x5c4a22);
      const neck = scene.add.rectangle(4, -18, 4.5, 10, 0xb89a5a).setRotation(0.25);
      const head = scene.add.ellipse(6, -24, 8, 6, 0xc8aa6a).setStrokeStyle(1, 0x5c4a22);
      const eye = scene.add.circle(8, -25, 1.1, 0xe83a2a);
      const tongue = scene.add.rectangle(11, -24, 4, 0.8, 0xe83a2a);
      body = coil1;
      fig.add([coil1, coil2, neck, head, eye, tongue]);
      anims.push(scene.tweens.add({ targets: [neck, head, eye, tongue], x: "+=2", duration: 700 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "entombed": {
      // the old kings' servants, still wrapped for the journey
      baseColor = 0xb8ac8a;
      const legs = scene.add.rectangle(0, -4, 10, 8, 0x8a8066);
      body = scene.add.rectangle(0, -14, 13, 15, baseColor);
      body.setStrokeStyle(1.5, 0x6a6046, 0.9);
      const wrapA = scene.add.rectangle(0, -11, 14, 1.6, 0x9a8e6c).setRotation(0.18);
      const wrapB = scene.add.rectangle(0, -17, 14, 1.6, 0x9a8e6c).setRotation(-0.14);
      const head = scene.add.circle(0, -25, 4.6, 0xa89c7a).setStrokeStyle(1, 0x6a6046);
      const wrapH = scene.add.rectangle(0, -26, 9.5, 2, 0x8a8066);
      const eye = scene.add.circle(-1.6, -24.4, 1.1, 0x50c8b0); // one embalmed eye still burns
      const armL = scene.add.rectangle(-8, -14, 4, 11, 0x9a8e6c).setRotation(0.35);
      fig.add([legs, armL, body, wrapA, wrapB, head, wrapH, eye]);
      anims.push(scene.tweens.add({ targets: eye, alpha: 0.35, duration: 900 + jitter, yoyo: true, repeat: -1 }));
      break;
    }

    case "duneprowler": {
      // lean cat of the flats — mostly shoulder, all appetite
      baseColor = 0xc09a5a;
      const bodyE = scene.add.ellipse(0, -9, 22, 11, baseColor);
      bodyE.setStrokeStyle(1.5, 0x6a5228, 0.9);
      const haunch = scene.add.ellipse(-7, -8, 10, 9, 0xb08a4a);
      const head = scene.add.ellipse(10, -13, 9, 7, 0xc8a462).setStrokeStyle(1, 0x6a5228);
      const earL = scene.add.triangle(8, -18, 0, 4, -2, -3, 3, 0, 0xb08a4a);
      const earR = scene.add.triangle(12, -18, 0, 4, 2, -3, -3, 0, 0xb08a4a);
      const eye = scene.add.circle(12, -13.5, 1.1, 0xffe060);
      const tail = scene.add.rectangle(-13, -12, 9, 1.8, 0xb08a4a).setRotation(-0.5);
      const legF = scene.add.rectangle(7, -3, 2.4, 7, 0xb08a4a);
      const legB = scene.add.rectangle(-6, -3, 2.4, 7, 0xb08a4a);
      body = bodyE;
      fig.add([tail, legF, legB, haunch, bodyE, head, earL, earR, eye]);
      anims.push(scene.tweens.add({ targets: tail, rotation: "-=0.35", duration: 500 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "carrionbird": {
      // vultures with opinions about how alive you are
      baseColor = 0x4a4038;
      const bodyE = scene.add.ellipse(0, -14, 13, 10, baseColor);
      bodyE.setStrokeStyle(1.5, 0x2a221c, 0.9);
      const wingL = scene.add.triangle(-9, -16, 0, 6, -9, -4, 2, -2, 0x3a322a);
      const wingR = scene.add.triangle(9, -16, 0, 6, 9, -4, -2, -2, 0x3a322a);
      const neck = scene.add.rectangle(3, -21, 2.5, 7, 0xc8a8a0);
      const head = scene.add.circle(4, -25, 3, 0xc8a8a0);
      const beak = scene.add.triangle(8, -25, 0, 2, 5, 0, 0, -2, 0xd8b13a);
      const eye = scene.add.circle(4.6, -25.6, 0.9, 0x1a1a1a);
      body = bodyE;
      fig.add([wingL, wingR, bodyE, neck, head, beak, eye]);
      anims.push(scene.tweens.add({ targets: [wingL, wingR], scaleY: 1.3, duration: 300 + jitter * 0.4, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: fig, y: "-=4", duration: 800 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "nyzat": {
      // Queen Nyzat, the Embalmed: gold mask, dead wrappings, a crown that remembers
      baseColor = 0xc8ac6a;
      const legs = scene.add.rectangle(0, -5, 16, 10, 0x8a7a52);
      body = scene.add.ellipse(0, -20, 24, 24, baseColor);
      body.setStrokeStyle(2, 0x6a5a32, 0.9);
      const wrapA = scene.add.rectangle(0, -16, 25, 2.2, 0xa89468).setRotation(0.16);
      const wrapB = scene.add.rectangle(0, -24, 25, 2.2, 0xa89468).setRotation(-0.12);
      const collar = scene.add.ellipse(0, -30, 18, 6, 0xd8b13a).setStrokeStyle(1, 0x8a6a1a);
      const head = scene.add.circle(0, -36, 6.5, 0xe8cc7a).setStrokeStyle(1.5, 0x8a6a1a); // the golden mask
      const eyeL = scene.add.circle(-2.4, -36.5, 1.4, 0x50e8b0);
      const eyeR = scene.add.circle(2.4, -36.5, 1.4, 0x50e8b0);
      const crownL = scene.add.triangle(-4, -43, 0, 5, -2, -5, 3, 1, 0xd8b13a);
      const crownM = scene.add.triangle(0, -44, 0, 5, 0, -6, 0, 0, 0xd8b13a);
      const crownR = scene.add.triangle(4, -43, 0, 5, 2, -5, -3, 1, 0xd8b13a);
      const scepter = scene.add.rectangle(13, -22, 2.5, 24, 0x8a6a1a);
      const scepterHead = scene.add.circle(13, -35, 3.5, 0x50e8b0).setStrokeStyle(1, 0x2a6a52);
      fig.add([legs, scepter, scepterHead, body, wrapA, wrapB, collar, head, eyeL, eyeR, crownL, crownM, crownR]);
      anims.push(scene.tweens.add({ targets: [scepterHead], alpha: 0.5, duration: 800 + jitter, yoyo: true, repeat: -1 }));
      anims.push(scene.tweens.add({ targets: [eyeL, eyeR], alpha: 0.4, duration: 1200 + jitter, yoyo: true, repeat: -1 }));
      break;
    }

    case "mudling": {
      // river-mud given bad intentions
      baseColor = 0x4a4030;
      body = scene.add.ellipse(0, -8, 13, 11, baseColor);
      body.setStrokeStyle(1.5, 0x2a2418, 0.9);
      const drip = scene.add.ellipse(-4, -3, 4, 5, 0x3a3224);
      const eyeL = scene.add.circle(-2, -10, 1.3, 0x8ad07f);
      const eyeR = scene.add.circle(2.4, -9, 1.3, 0x8ad07f);
      const armL = scene.add.ellipse(-7, -7, 5, 4, 0x3a3224);
      fig.add([drip, armL, body, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: body, scaleY: 0.88, duration: 500 + jitter * 0.5, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "blowreed": {
      // a hunter of the reeds, all stilts and patience, dart-pipe raised
      baseColor = 0x3a5c34;
      const legs = scene.add.rectangle(0, -4, 7, 8, 0x2a4426);
      body = scene.add.ellipse(0, -13, 11, 12, baseColor);
      body.setStrokeStyle(1.5, 0x1e3018, 0.9);
      const head = scene.add.circle(0, -22, 4, 0x568a4a);
      const mask = scene.add.rectangle(0, -22.5, 8, 2.5, 0x1e3018);
      const eye = scene.add.circle(1.5, -23, 1, 0xffe060);
      const pipe = scene.add.rectangle(8, -22, 11, 1.8, 0x7a6a3a).setRotation(-0.1);
      const plume = scene.add.triangle(0, -28, 0, 4, -2, -5, 2, 0, 0xd85a4a);
      fig.add([legs, body, pipe, head, mask, eye, plume]);
      anims.push(scene.tweens.add({ targets: pipe, rotation: "+=0.1", duration: 900 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "riverfang": {
      // low, long, and mostly teeth — the river's opinion of you
      baseColor = 0x3e5a48;
      const bodyE = scene.add.ellipse(0, -7, 26, 9, baseColor);
      bodyE.setStrokeStyle(1.5, 0x22362a, 0.9);
      const ridgeA = scene.add.triangle(-6, -12, 0, 3, -2, -3, 3, 1, 0x22362a);
      const ridgeB = scene.add.triangle(0, -13, 0, 3, -2, -3, 3, 1, 0x22362a);
      const snout = scene.add.ellipse(13, -8, 11, 5.5, 0x4a6a54).setStrokeStyle(1, 0x22362a);
      const eye = scene.add.circle(9, -11, 1.2, 0xffd54a);
      const teeth = scene.add.rectangle(15, -6.5, 6, 1, 0xd8d0b0);
      const tail = scene.add.triangle(-15, -7, 0, 3, -7, 0, 0, -3, 0x35503f);
      body = bodyE;
      fig.add([tail, bodyE, ridgeA, ridgeB, snout, teeth, eye]);
      anims.push(scene.tweens.add({ targets: tail, rotation: "+=0.3", duration: 420 + jitter * 0.4, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "vinehorror": {
      // the garden fights back: a knot of strangler vine walking on its roots
      baseColor = 0x2e5230;
      body = scene.add.ellipse(0, -15, 20, 22, baseColor);
      body.setStrokeStyle(2, 0x18301c, 0.9);
      const vineL = scene.add.rectangle(-11, -12, 12, 2.5, 0x244a28).setRotation(-0.7);
      const vineR = scene.add.rectangle(11, -16, 12, 2.5, 0x244a28).setRotation(0.6);
      const bloom = scene.add.circle(3, -24, 3, 0xd85a8a).setStrokeStyle(1, 0x6a2242);
      const eyeA = scene.add.circle(-3, -18, 1.4, 0xcfff60);
      const eyeB = scene.add.circle(2, -13, 1.2, 0xcfff60);
      const roots = scene.add.ellipse(0, -3, 16, 6, 0x18301c);
      fig.add([roots, vineL, vineR, body, bloom, eyeA, eyeB]);
      anims.push(scene.tweens.add({ targets: [vineL, vineR], rotation: "+=0.35", duration: 800 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "bogwitch": {
      // she stirs the water and the water listens
      baseColor = 0x3a4a3e;
      const skirt = scene.add.triangle(0, -6, -8, 6, 8, 6, 0, -10, 0x2a3a2e);
      body = scene.add.ellipse(0, -16, 13, 13, baseColor);
      body.setStrokeStyle(1.5, 0x1e2a20, 0.9);
      const shawl = scene.add.ellipse(0, -21, 14, 6, 0x2a3a2e);
      const head = scene.add.circle(0, -26, 4, 0x8aa082);
      const hair = scene.add.ellipse(0, -29, 9, 4, 0x4a5a44);
      const eyeL = scene.add.circle(-1.5, -26, 1, 0xcfff60);
      const eyeR = scene.add.circle(1.5, -26, 1, 0xcfff60);
      const orb = scene.add.circle(9, -18, 2.6, 0x8ad0ff, 0.9);
      fig.add([skirt, body, shawl, orb, head, hair, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: orb, y: "-=3", alpha: 0.5, duration: 700 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "ashfiend": {
      // cinder given a spine — it crackles when it walks
      baseColor = 0x4a2c22;
      const legs = scene.add.rectangle(0, -4, 11, 8, 0x301a14);
      body = scene.add.ellipse(0, -14, 16, 16, baseColor);
      body.setStrokeStyle(1.5, 0x241210, 0.9);
      const crack = scene.add.rectangle(-2, -14, 1.8, 12, 0xff7830, 0.85).setRotation(0.3);
      const crack2 = scene.add.rectangle(4, -12, 1.4, 8, 0xff7830, 0.7).setRotation(-0.4);
      const head = scene.add.circle(0, -24, 4.5, 0x5a3428);
      const eyeL = scene.add.circle(-1.8, -24.5, 1.2, 0xffb040);
      const eyeR = scene.add.circle(1.8, -24.5, 1.2, 0xffb040);
      fig.add([legs, body, crack, crack2, head, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: [crack, crack2], alpha: 0.3, duration: 500 + jitter * 0.5, yoyo: true, repeat: -1 }));
      break;
    }

    case "doomguard": {
      // a wall of black plate that remembers being a soldier
      baseColor = 0x2c2430;
      const legs = scene.add.rectangle(0, -5, 15, 10, 0x1c161e);
      body = scene.add.rectangle(0, -17, 19, 18, baseColor);
      body.setStrokeStyle(2, 0x14101a, 0.9);
      const pauldronL = scene.add.ellipse(-10, -24, 9, 7, 0x3a3040);
      const pauldronR = scene.add.ellipse(10, -24, 9, 7, 0x3a3040);
      const helm = scene.add.rectangle(0, -30, 10, 9, 0x3a3040).setStrokeStyle(1, 0x14101a);
      const slit = scene.add.rectangle(0, -30, 7, 1.6, 0xe83a2a);
      const blade = scene.add.rectangle(14, -20, 3, 22, 0x6a6a78).setStrokeStyle(1, 0x2c2c36);
      fig.add([legs, blade, body, pauldronL, pauldronR, helm, slit]);
      anims.push(scene.tweens.add({ targets: slit, alpha: 0.4, duration: 1100 + jitter, yoyo: true, repeat: -1 }));
      break;
    }

    case "flamecaller": {
      // robes the color of a dying fire, hands full of the real thing
      baseColor = 0x5a2018;
      const skirt = scene.add.triangle(0, -5, -9, 7, 9, 7, 0, -12, 0x40140e);
      body = scene.add.ellipse(0, -16, 14, 14, baseColor);
      body.setStrokeStyle(1.5, 0x30100a, 0.9);
      const hood = scene.add.circle(0, -26, 5, 0x40140e);
      const face = scene.add.circle(0, -25.5, 3, 0x0c0608);
      const eyeL = scene.add.circle(-1.3, -25.5, 0.9, 0xffb040);
      const eyeR = scene.add.circle(1.3, -25.5, 0.9, 0xffb040);
      const flame = scene.add.circle(9, -19, 3, 0xff8830, 0.95);
      const flameCore = scene.add.circle(9, -19, 1.4, 0xffe060);
      fig.add([skirt, body, hood, face, eyeL, eyeR, flame, flameCore]);
      anims.push(scene.tweens.add({ targets: [flame, flameCore], scale: 1.35, alpha: 0.6, duration: 380 + jitter * 0.4, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "flayed": {
      // what the Hollow Kings do to deserters — fast, red, and screaming
      baseColor = 0x9a3a32;
      const legs = scene.add.rectangle(0, -4, 8, 7, 0x6a2420);
      body = scene.add.ellipse(0, -13, 12, 13, baseColor);
      body.setStrokeStyle(1.5, 0x501814, 0.9);
      const sinewA = scene.add.rectangle(0, -12, 11, 1.2, 0x6a2420).setRotation(0.4);
      const sinewB = scene.add.rectangle(0, -15, 11, 1.2, 0x6a2420).setRotation(-0.35);
      const head = scene.add.circle(0, -21, 3.6, 0xb0453a);
      const jaw = scene.add.rectangle(0, -18.5, 5, 1.6, 0x2a0c0a);
      const eyeL = scene.add.circle(-1.4, -21.5, 1, 0xffffff);
      const eyeR = scene.add.circle(1.4, -21.5, 1, 0xffffff);
      fig.add([legs, body, sinewA, sinewB, head, jaw, eyeL, eyeR]);
      anims.push(scene.tweens.add({ targets: jaw, scaleY: 1.8, duration: 260 + jitter * 0.3, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    case "ssarim": {
      // the Drowned God: a river wearing a king's shape, crowned in silt
      baseColor = 0x2e6a5c;
      const pool = scene.add.ellipse(0, -2, 30, 9, 0x1a3a34, 0.8);
      const legs = scene.add.rectangle(0, -8, 14, 10, 0x224a40);
      body = scene.add.ellipse(0, -22, 24, 24, baseColor);
      body.setStrokeStyle(2, 0x143028, 0.9);
      const currentA = scene.add.rectangle(0, -18, 22, 1.6, 0x50c8b0, 0.7).setRotation(0.12);
      const currentB = scene.add.rectangle(0, -26, 22, 1.6, 0x50c8b0, 0.5).setRotation(-0.1);
      const head = scene.add.circle(0, -37, 6, 0x3a8a76).setStrokeStyle(1.5, 0x143028);
      const eyeL = scene.add.circle(-2.2, -37.5, 1.5, 0xb0fff0);
      const eyeR = scene.add.circle(2.2, -37.5, 1.5, 0xb0fff0);
      const crownL = scene.add.rectangle(-4, -43, 1.8, 6, 0x88b8a8).setRotation(-0.2);
      const crownM = scene.add.rectangle(0, -44.5, 1.8, 8, 0x88b8a8);
      const crownR = scene.add.rectangle(4, -43, 1.8, 6, 0x88b8a8).setRotation(0.2);
      const orb = scene.add.circle(13, -28, 3.5, 0x8ad0ff, 0.9);
      fig.add([pool, legs, orb, body, currentA, currentB, head, eyeL, eyeR, crownL, crownM, crownR]);
      anims.push(scene.tweens.add({ targets: [currentA, currentB], x: "+=3", duration: 900 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      anims.push(scene.tweens.add({ targets: orb, y: "-=4", duration: 1000 + jitter, yoyo: true, repeat: -1, ease: "sine.inout" }));
      break;
    }

    default: {
      baseColor = 0x6b8f4e;
      body = scene.add.circle(0, -11, 9, baseColor);
      body.setStrokeStyle(2, 0x2f3d22, 0.9);
      fig.add(body);
    }
  }

  // everything alive breathes (everything undead approximates it)
  anims.push(
    scene.tweens.add({
      targets: body,
      scaleX: body.scaleX * 1.04,
      scaleY: body.scaleY * 0.96,
      duration: 650 + jitter,
      yoyo: true,
      repeat: -1,
      ease: "sine.inout",
      delay: jitter,
    })
  );

  return { figure: fig, body, baseColor, anims };
}
