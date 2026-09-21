import type { GreenGeometry } from "./course";

// Public GolfTraxx geometry captured from the verified 18-hole and 19–27
// layouts. This is bundled so an active round does not depend on cross-origin
// requests or network availability.
export const HERMANUS_IMPORTED_GEOMETRY: Record<number, GreenGeometry> = {
  1: { front: { latitude: -34.40673483373951, longitude: 19.254119396222865 }, centre: { latitude: -34.40664377931093, longitude: 19.254041135932738 }, back: { latitude: -34.406550511830666, longitude: 19.253968240014675 } },
  2: { front: { latitude: -34.40427588798392, longitude: 19.258850336676936 }, centre: { latitude: -34.404206963075055, longitude: 19.25895446652288 }, back: { latitude: -34.40415795534214, longitude: 19.25906664309583 } },
  3: { front: { latitude: -34.401363189735896, longitude: 19.262886584977803 }, centre: { latitude: -34.4012942650341, longitude: 19.263068498904005 }, back: { latitude: -34.40122534035623, longitude: 19.26323163745807 } },
  4: { front: { latitude: -34.40098443151414, longitude: 19.265915663804847 }, centre: { latitude: -34.40099296552032, longitude: 19.26616195075892 }, back: { latitude: -34.40100813882497, longitude: 19.266386780085956 } },
  5: { front: { latitude: -34.400811490993895, longitude: 19.262511464322024 }, centre: { latitude: -34.40084436920233, longitude: 19.262417110740078 }, back: { latitude: -34.400875034296, longitude: 19.26233080376711 } },
  6: { front: { latitude: -34.40394265810561, longitude: 19.25796464382204 }, centre: { latitude: -34.404028644664336, longitude: 19.25784615036711 }, back: { latitude: -34.40411463124615, longitude: 19.257735703503176 } },
  7: { front: { latitude: -34.40540734494895, longitude: 19.25353047599584 }, centre: { latitude: -34.40547783742266, longitude: 19.253401253704812 }, back: { latitude: -34.40554611698206, longitude: 19.25326398477695 } },
  8: { front: { latitude: -34.40970895199965, longitude: 19.252021257222047 }, centre: { latitude: -34.40985246160693, longitude: 19.25198591221301 }, back: { latitude: -34.40998933247687, longitude: 19.25194520278598 } },
  9: { front: { latitude: -34.4099586790909, longitude: 19.254181300358084 }, centre: { latitude: -34.409900817552646, longitude: 19.254269336958934 }, back: { latitude: -34.409858446076484, longitude: 19.254365420186787 } },
  10: { front: { latitude: -34.407526379709644, longitude: 19.25692204168597 }, centre: { latitude: -34.40745745424246, longitude: 19.25705299362203 }, back: { latitude: -34.407408445288304, longitude: 19.257183945567114 } },
  11: { front: { latitude: -34.40406939039524, longitude: 19.259737884858925 }, centre: { latitude: -34.40394735286762, longitude: 19.259831285913016 }, back: { latitude: -34.40383638032408, longitude: 19.259911275976947 } },
  12: { front: { latitude: -34.401577172201065, longitude: 19.263285971113007 }, centre: { latitude: -34.401506034648506, longitude: 19.26336864337696 }, back: { latitude: -34.40144153626017, longitude: 19.263456679985964 } },
  13: { front: { latitude: -34.40261478388926, longitude: 19.264131731868755 }, centre: { latitude: -34.40274946006372, longitude: 19.26416075989582 }, back: { latitude: -34.40287970991866, longitude: 19.264192470095804 } },
  14: { front: { latitude: -34.40596939183188, longitude: 19.26608122154992 }, centre: { latitude: -34.40607307787122, longitude: 19.266115614022873 }, back: { latitude: -34.40617233803448, longitude: 19.26615805310484 } },
  15: { front: { latitude: -34.407349949661, longitude: 19.261553176468 }, centre: { latitude: -34.407407161331, longitude: 19.261423954213 }, back: { latitude: -34.407475437747, longitude: 19.261308142958 } },
  16: { front: { latitude: -34.40626528117231, longitude: 19.262248733449088 }, centre: { latitude: -34.4061897166969, longitude: 19.26235286332201 }, back: { latitude: -34.40610751345118, longitude: 19.262465039840045 } },
  17: { front: { latitude: -34.4071390725707, longitude: 19.257952699513854 }, centre: { latitude: -34.40718079392396, longitude: 19.257877121331862 }, back: { latitude: -34.40723357996812, longitude: 19.257809589876956 } },
  18: { front: { latitude: -34.40963269208834, longitude: 19.255571762731044 }, centre: { latitude: -34.4097275186418, longitude: 19.25546936251302 }, back: { latitude: -34.40981128086436, longitude: 19.255383055494967 } },
  19: { front: { latitude: -34.4063254372, longitude: 19.2565360666 }, centre: { latitude: -34.4062188911, longitude: 19.2566401964 }, back: { latitude: -34.4061167709, longitude: 19.2567389619 } },
  20: { front: { latitude: -34.4061104559, longitude: 19.2536548978 }, centre: { latitude: -34.4061278379, longitude: 19.2535095823 }, back: { latitude: -34.4061430071, longitude: 19.2533776777 } },
  21: { front: { latitude: -34.40537542652414, longitude: 19.252206028708198 }, centre: { latitude: -34.40525560621641, longitude: 19.25213045060818 }, back: { latitude: -34.4051379989, longitude: 19.2520387792 } },
  22: { front: { latitude: -34.4095663955, longitude: 19.2511568087 }, centre: { latitude: -34.4097010621, longitude: 19.2511456036 }, back: { latitude: -34.4098180256, longitude: 19.2511397629 } },
  23: { front: { latitude: -34.4071650743, longitude: 19.2500244403 }, centre: { latitude: -34.4070784513, longitude: 19.250037375 }, back: { latitude: -34.4069940413, longitude: 19.2500315343 } },
  24: { front: { latitude: -34.406992146591136, longitude: 19.247906360009836 }, centre: { latitude: -34.40692986276958, longitude: 19.247761044372954 }, back: { latitude: -34.4068808566, longitude: 19.2476291399 } },
  25: { front: { latitude: -34.4065979205, longitude: 19.2452826833 }, centre: { latitude: -34.4065046537, longitude: 19.245166872 }, back: { latitude: -34.4064379422, longitude: 19.2450859295 } },
  26: { front: { latitude: -34.40826836, longitude: 19.248643015 }, centre: { latitude: -34.4082901623, longitude: 19.2487954246 }, back: { latitude: -34.4083075388, longitude: 19.2489424698 } },
  27: { front: { latitude: -34.4104499322, longitude: 19.2535268413 }, centre: { latitude: -34.4104518175, longitude: 19.2536738865 }, back: { latitude: -34.4104559158, longitude: 19.2538182496 } },
};
