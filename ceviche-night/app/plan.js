/* Ceviche Night — the whole day as data.
 * Content only. Schema: see engine.js header (and Engine.validate).
 * Quantities are the chosen recipes scaled for 2 people:
 *   ceviche x0.5, tacos x0.5 (6 tacos), beans x0.5, rice x0.5, pickled onions x1, slaw x1, elote x1 (4 ears).
 * `steps` is THE MASTER ORDER: earlier in the array = higher priority when several steps are possible.
 */
(function (root) {
  'use strict';

  var PLAN = {
    version: 1,
    title: 'Ceviche Night',

    // minutes after local midnight on the cook day (all editable in the app)
    anchors: { start: 420, leaveAm: 660, backHome: 840, leavePm: 870, arrive: 900, dinner: 1170 },
    anchorLabels: {
      start: 'Start cooking',
      leaveAm: 'Leave for appointment',
      backHome: 'Back home',
      leavePm: 'Leave for her place',
      arrive: 'Arrive at her place',
      dinner: 'Dinner'
    },

    optionDefaults: { soaked: true, beansLater: false, beansStored: false },

    rules: [
      // He walked out with the beans started but not finished: finish them at her place.
      { on: 'm-leave-am', ifDone: 'beans-heat', ifNotDone: 'beans-off', set: { beansLater: true } },
      // The leave checklist covers "beans are in the fridge", so stop asking about it afterwards.
      { on: 'm-leave-am', set: { beansStored: true } }
    ],

    /* ------------------------------------------------------------------ dishes */
    dishes: [
      {
        id: 'scoop', nick: 'The Classic Scoop', name: 'Classic ceviche', color: 'scoop',
        blurb: 'Lime-cured halibut with tomato, serrano, olives and avocado.',
        makes: 'A starter for 2, with some left over',
        source: { label: 'Rick Bayless, Classic Ceviche', url: 'https://www.rickbayless.com/recipe/classic-ceviche' },
        ingredients: [
          { qty: '½ pound', item: 'skinless halibut', note: 'about two-thirds of your fillet, cut in ½-inch cubes' },
          { qty: '¾ cup', item: 'fresh lime juice', note: 'about 6 limes' },
          { qty: '½ medium', item: 'white onion', note: 'one wedge of your jumbo onion, in ¼-inch dice' },
          { qty: '½ pound', item: 'ripe tomatoes', note: '2 Roma tomatoes, in ¼-inch dice' },
          { qty: '1', item: 'serrano chile', note: 'seeded and finely chopped' },
          { qty: '2 tablespoons + 2 teaspoons', item: 'chopped cilantro', note: 'plus a few leaves for the top' },
          { qty: '2 tablespoons + 2 teaspoons', item: 'pitted green olives', note: 'chopped, about 8 to 10 olives' },
          { qty: '2¼ teaspoons', item: 'extra-virgin olive oil', note: 'optional' },
          { qty: 'A generous ¼ teaspoon', item: 'salt', note: '¼ teaspoon plus a pinch' },
          { qty: '1 tablespoon + 1½ teaspoons', item: 'fresh orange juice', note: 'half an orange has plenty' },
          { qty: '½ large', item: 'ripe avocado', note: 'diced, added at the very end' },
          { qty: 'For scooping', item: 'tostadas, tortilla chips, saltines' }
        ],
        gear: [
          'Medium bowl, glass or stainless steel (never aluminum)',
          'Large bowl',
          'Strainer',
          'Cutting board and sharp knife',
          'Measuring spoons',
          'Lime squeezer'
        ],
        notes: [
          'Lime juice does not kill germs or parasites. The fish must be very fresh and stay cold.',
          'Once the fish is white all the way through, drain it. Fish left in lime juice for hours turns mushy.',
          'Mix the fish with the tomatoes no more than 2 hours before dinner.',
          'Avocado goes in at the last minute.',
          'Throw away any ceviche that sat out for more than 2 hours.',
          'Tell your date the fish is raw and was never frozen, so she can choose.'
        ]
      },
      {
        id: 'pink', nick: 'Smoke & Pink', name: 'Chipotle-lime shrimp tacos with pink sauce', color: 'pink',
        blurb: 'Seared chipotle-lime shrimp, slaw, pink sauce, lime.',
        makes: '6 tacos',
        source: { label: 'RecipeTin Eats, Prawn Tacos', url: 'https://www.recipetineats.com/prawn-tacos-shrimp' },
        ingredients: [
          { qty: '½ pound', item: 'shrimp, peeled and deveined', note: 'about half your package' },
          { qty: 'Marinade', item: '' },
          { qty: 'Zest of ½', item: 'lime' },
          { qty: '2 tablespoons', item: 'fresh lime juice' },
          { qty: '1½ teaspoons', item: 'chipotle powder', note: '1 teaspoon for mild' },
          { qty: '1 tablespoon', item: 'finely chopped cilantro' },
          { qty: '1', item: 'garlic clove', note: 'minced' },
          { qty: '2 tablespoons', item: 'olive oil' },
          { qty: '¼ teaspoon', item: 'salt' },
          { qty: '¼ teaspoon', item: 'black pepper' },
          { qty: 'Pink sauce', item: '' },
          { qty: '6 tablespoons', item: 'sour cream' },
          { qty: '1 to 1½ tablespoons', item: 'sriracha', note: 'to taste' },
          { qty: 'To cook and serve', item: '' },
          { qty: '1½ teaspoons', item: 'olive oil', note: 'for the skillet' },
          { qty: '6', item: 'small corn tortillas' },
          { qty: '1', item: 'lime', note: 'cut in wedges' },
          { qty: '', item: 'The Smoky Cream slaw' }
        ],
        gear: [
          '12-inch cast-iron skillet',
          'Oven mitt',
          'Tongs',
          'Medium bowl',
          'Serving bowl and foil',
          'Paper towels',
          'Clean kitchen towel and a microwave'
        ],
        notes: [
          'Marinate the shrimp 5 to 20 minutes, never longer. The lime starts to cook them.',
          'Your shrimp are extra large. They may need a little more than 60 seconds per side.',
          'Done means pink, white inside, and curled into a loose C.',
          'Build order: shrimp, slaw, pink sauce, a squeeze of lime.'
        ]
      },
      {
        id: 'patron', nick: 'The Patrón', name: 'Charro beans', color: 'patron',
        blurb: 'Pinto beans simmered with pork, bacon, poblano, tomato and beer.',
        makes: 'About 5 cups',
        source: { label: 'Rick Bayless, Authentic Mexican (frijoles charros)', url: null },
        ingredients: [
          { qty: '½ pound', item: 'dried pinto beans', note: 'about 1¼ cups, half the bag' },
          { qty: '4 cups', item: 'water', note: 'for soaking' },
          { qty: '3½ cups', item: 'fresh water', note: 'for cooking' },
          { qty: '½ cup', item: 'beer' },
          { qty: '2 ounces', item: 'pork', note: '3 or 4 chunks of the stew meat, cut in ½-inch pieces' },
          { qty: '4 slices', item: 'thick-cut bacon', note: 'in ½-inch pieces' },
          { qty: '½ medium', item: 'white onion', note: 'one wedge of your jumbo onion, diced' },
          { qty: '1 large', item: 'poblano chile', note: 'your store calls it pasilla; blackened, peeled, seeded, chopped' },
          { qty: 'Half a can', item: 'plain diced tomatoes', note: 'drained' },
          { qty: '½ teaspoon', item: 'salt', note: 'or to taste' },
          { qty: '¼ cup', item: 'cilantro', note: 'roughly chopped, stirred in at dinner' }
        ],
        gear: [
          'Big heavy pot with a lid (4 quarts or larger)',
          'Skillet',
          'Tongs',
          'Bowl and a plate to cover it',
          'Strainer',
          'Slotted spoon',
          'Kitchen scissors',
          'Heatproof mug',
          'Bean tub with a lid (2 quarts)',
          'Wooden spoon',
          'Can opener',
          'Oven mitt or a thick dry towel'
        ],
        notes: [
          'An overnight soak saves about an hour in the morning. The 1-hour quick soak works too.',
          'Beans are done when 3 of them mash easily against the roof of your mouth.',
          'They keep for several days in the fridge and taste better the next day.',
          'Freeze the leftover pork and bacon.'
        ]
      },
      {
        id: 'milky', nick: 'The Milky Way', name: 'Red tomato rice', color: 'milky',
        blurb: 'Rice toasted until milky white, then cooked in tomato and broth.',
        makes: 'About 3 cups',
        source: { label: 'Rick Bayless, Red Tomato Rice', url: 'https://www.rickbayless.com/recipe/red-tomato-rice' },
        ingredients: [
          { qty: 'Half a can', item: 'fire-roasted diced tomatoes', note: 'lightly drained, about ¾ cup' },
          { qty: '¼ small', item: 'white onion', note: 'a chunk the size of a ping-pong ball' },
          { qty: '1', item: 'garlic clove', note: 'cut in half' },
          { qty: '2¼ teaspoons', item: 'vegetable oil' },
          { qty: '¾ cup', item: 'white rice', note: 'do not rinse it' },
          { qty: '¾ cup + 2 tablespoons', item: 'chicken broth' },
          { qty: '2', item: 'serrano chiles', note: 'whole, with a slit down one side' },
          { qty: '2 tablespoons', item: 'chopped parsley' },
          { qty: 'A generous ¼ teaspoon', item: 'salt', note: '¾ teaspoon if the broth is unsalted' },
          { qty: 'Optional', item: 'a handful of shredded carrots' }
        ],
        gear: [
          'Blender',
          'Saucepan with a tight lid that holds 6 to 8 cups',
          'Wooden spoon',
          'Fork',
          'Purée jar, broth jar, zip bag'
        ],
        notes: [
          'Do not lift the lid during the 20 minutes.',
          'Covered and off the heat, the rice stays hot for about 30 minutes.',
          'To reheat: add a splash of broth, cover, warm gently.'
        ]
      },
      {
        id: 'blanch', nick: 'The Blanch', name: 'Pickled red onions', color: 'blanch',
        blurb: 'Pink, sharp, crunchy. They go on everything.',
        makes: 'About 2 cups',
        source: { label: 'Mexico in My Kitchen, Pickled Red Onions', url: 'https://www.mexicoinmykitchen.com/pickled-red-onions' },
        ingredients: [
          { qty: '2 medium', item: 'red onions', note: 'yours are large, so use 1½; thinly sliced' },
          { qty: '5 cups', item: 'water', note: 'for the hot dunk' },
          { qty: '½ cup', item: 'white vinegar' },
          { qty: '½ cup', item: 'water' },
          { qty: '1 teaspoon', item: 'dried Mexican oregano', note: 'toasted' },
          { qty: '2', item: 'whole allspice berries' },
          { qty: '3', item: 'black peppercorns' },
          { qty: '1', item: 'bay leaf' },
          { qty: '½ teaspoon', item: 'salt' }
        ],
        gear: [
          'Medium pot with a lid',
          'Skillet (dry, for the oregano)',
          'Strainer',
          'Quart jar with a lid'
        ],
        notes: [
          'You like strong onion flavor, so the hot dunk is 30 seconds. For milder onions use 2 minutes.',
          'Ready after about 2 hours in the fridge. Better by dinner.',
          'They keep up to 2 weeks in the fridge in their liquid. Take them out with a clean fork.'
        ]
      },
      {
        id: 'cream', nick: 'The Smoky Cream', name: 'Creamy chipotle slaw', color: 'cream',
        blurb: 'Goes inside the tacos and next to them.',
        makes: 'About 6 cups: enough for the tacos plus a side',
        source: { label: 'Leite\'s Culinaria, adapted from Daphne Oz', url: null },
        ingredients: [
          { qty: '4 cups', item: 'shredded green cabbage', note: 'about a quarter of the head' },
          { qty: '1 cup', item: 'shredded purple cabbage' },
          { qty: '1 cup', item: 'shredded carrots', note: 'from the bag (the recipe\'s 2 medium carrots)' },
          { qty: '1 small', item: 'red onion', note: 'use the half of a large one left from the pickles; sliced very thin' },
          { qty: '3 large', item: 'scallions', note: 'thinly sliced' },
          { qty: '1', item: 'jalapeño', note: 'seeded and minced' },
          { qty: 'Dressing', item: '' },
          { qty: '½ cup', item: 'mayonnaise' },
          { qty: '½ cup', item: 'full-fat plain Greek yogurt' },
          { qty: '¼ cup', item: 'fresh lime juice' },
          { qty: '2 tablespoons', item: 'sugar' },
          { qty: '1 teaspoon', item: 'ground cumin' },
          { qty: '1 teaspoon', item: 'chipotle powder' },
          { qty: '½ teaspoon', item: 'salt', note: 'to taste' },
          { qty: '¼ teaspoon', item: 'black pepper', note: 'to taste' }
        ],
        gear: [
          'Large bowl',
          '2-cup jar with a tight lid',
          'Cutting board and sharp knife',
          '1-cup measure'
        ],
        notes: [
          'Best dressed 1 to 4 hours before dinner.',
          'Pour off the liquid that collects before you serve it.',
          'Keeps 2 days but gets wetter.'
        ]
      },
      {
        id: 'elote', nick: 'Elote', name: 'Street corn, oven style', color: 'elote',
        blurb: 'Broiled corn with crema, cotija and chile.',
        makes: '4 ears',
        source: { label: 'Tasting Table, Elotes (quantities). Broiler method adapted: no grill.', url: 'https://www.tastingtable.com/cook/recipes/grilled-mexican-street-corn-recipe-elotes' },
        ingredients: [
          { qty: '4 ears', item: 'corn' },
          { qty: '2 tablespoons', item: 'vegetable oil' },
          { qty: '1 teaspoon', item: 'salt' },
          { qty: '1 teaspoon', item: 'black pepper' },
          { qty: '½ cup', item: 'sour cream' },
          { qty: '¼ cup', item: 'mayonnaise' },
          { qty: '1 tablespoon', item: 'lime juice', note: 'the juice of half a lime' },
          { qty: '½ cup', item: 'crumbled cotija cheese', note: 'plus a little extra' },
          { qty: 'Optional', item: 'chipotle powder', note: 'a light dusting' },
          { qty: '1', item: 'lime', note: 'cut in wedges for the table; an extra, not in the recipe' }
        ],
        gear: [
          'Sheet pan lined with foil',
          'Tongs',
          'Oven mitt',
          '2-cup tub with a lid',
          'Plate',
          'Oven with a broiler'
        ],
        notes: [
          'The broiler time is an estimate. Watch the corn, not the clock.',
          'Done means plump, shiny kernels with dark brown and black spots on every side. White corn stays pale.'
        ]
      }
    ],

    /* ---------------------------------------------------------------- glossary */
    glossary: {
      'dice': { term: 'Dice', text: 'Cut into small cubes.\nSlice into strips, then cut across the strips.\n¼ inch is about the size of a pea.' },
      'mince': { term: 'Mince', text: 'Chop as small as you can.\nRock the knife back and forth over the pile until the pieces are tiny.' },
      'chop': { term: 'Roughly chop', text: 'A few quick cuts.\nUneven pieces about the size of your fingernail are fine.' },
      'half-moons': { term: 'Half-moons', text: 'Cut the onion in half from top to bottom.\nLay each half flat side down.\nSlice across it. Each slice falls apart into half-circles.' },
      'zest': { term: 'Zest', text: 'The thin green outer skin of the lime. It holds the lime smell.\nScrape it off with a fine grater. Or peel thin strips with a vegetable peeler and chop them tiny.\nStop when you reach the white layer. The white part is bitter.' },
      'simmer': { term: 'Simmer', text: 'Just below boiling.\nA few small bubbles break the surface every second or two.\nIf it is bubbling hard, turn the heat down.' },
      'boil': { term: 'Full boil', text: 'Big bubbles all over the surface that do not stop when you stir.' },
      'heat': { term: 'Heat levels', text: 'On a dial marked 1 to 10:\nLow is 2.\nMedium-low is 3 to 4.\nMedium is 5.\nMedium-high is 7.\nHigh is 9 to 10.\nOther numbers on the dial? Medium is the middle number.\nOnly Lo, Med and Hi? Medium-low is halfway between Lo and Med. Medium-high is halfway between Med and Hi.\nGas with no marks? Look at the flame. Low is the smallest steady flame. High is the biggest flame that stays under the pan. Medium is halfway between.\nIf the food bubbles or browns too fast, turn the burner down.' },
      'lid-ajar': { term: 'Lid slightly open', text: 'Put the lid on, then slide it a little to one side.\nLeave a gap about as wide as a finger so steam can escape.' },
      'blanch': { term: 'Blanch', text: 'Dunk food in very hot water for a short time, then drain it.\nHere it takes the harsh bite off the raw onion and helps it turn pink.' },
      'toast': { term: 'Toast a spice', text: 'Heat a dry pan with no oil.\nAdd the spice and keep it moving until you can smell it, about 30 seconds.\nTip it out right away. It burns fast.' },
      'char': { term: 'Char', text: 'Burn the skin on purpose until it is black and blistered.\nThe skin gets peeled off. The flesh underneath turns soft and smoky.' },
      'seed': { term: 'Seed a chile', text: 'Cut off the stem. Slice the chile in half the long way.\nScrape out the seeds and the pale ribs with the tip of a spoon.\nThat is where most of the heat is.\nWash your hands with soap after. Do not touch your eyes.' },
      'bacon-fat': { term: 'Bacon fat', text: 'The melted fat left in the pan after frying bacon.\nIt is the cooking oil for the next step.' },
      'golden': { term: 'Deep golden', text: 'Past soft and see-through.\nThe onion is brown at the edges, the color of honey.' },
      'cook-dry': { term: 'Cook until dry', text: 'Keep cooking and stirring until the watery liquid is gone.\nTest: drag the spoon across the pan. If no liquid runs back into the path, it is done.' },
      'puree': { term: 'Purée', text: 'Blend until completely smooth, with no chunks.' },
      'cure': { term: 'Cure', text: 'Lime juice firms up raw fish and turns it white, the way cooking does.\nIt does not kill germs or parasites. That is why the fish must be very fresh and stay cold.' },
      'opaque': { term: 'Opaque', text: 'Solid white all the way through.\nNo shiny, see-through center.' },
      'float': { term: 'Float freely', text: 'There is enough juice that the pieces move around when you stir.\nIf the fish is packed tight, the juice cannot reach every side.' },
      'fold': { term: 'Fold', text: 'Mix gently so nothing gets mashed.\nSlide a spoon down the side of the bowl, under, and up over the top.\nTurn the bowl and repeat.' },
      'fluff': { term: 'Fluff', text: 'Drag a fork through the rice to separate the grains.\nDo not stir or press. That makes it mushy.' },
      'shimmer': { term: 'Shimmering oil', text: 'Hot oil looks thin and shiny. Faint ripples move across it.\nYou may see the first thin wisp of smoke.\nThat is the moment to add the food.\nDo not tilt the pan to check. The handle is very hot.' },
      'tent': { term: 'Tent with foil', text: 'Lay a sheet of foil loosely over the top.\nIt holds the heat in.' },
      'pat-dry': { term: 'Pat dry', text: 'Press paper towels onto the food to soak up the water on its surface.\nDry food browns. Wet food steams.' },
      'c-shape': { term: 'Loose C', text: 'A cooked shrimp curls into the letter C.\nIf it curls tight into an O, it is overcooked.' },
      'wedges': { term: 'Wedges', text: 'Cut the lime in half from tip to tip.\nCut each half the long way into 3 pieces.' },
      'scallions': { term: 'Scallions', text: 'Also called green onions.\nCut off the hairy root end.\nUse both the white and the green parts.' },
      'avocado': { term: 'Open an avocado', text: 'Lay the avocado on the cutting board. Do not hold it in your hand.\nCut into it the long way until the knife hits the pit.\nRoll the avocado so the cut goes all the way around the pit.\nTwist the two halves apart.\nNeed the half with the pit? Scoop the pit out with a spoon.' },
      'slit': { term: 'Slit', text: 'One shallow cut down the side of the chile, from stem to tip.\nThe chile stays whole but lets its flavor out.' },
      'milky': { term: 'Milky white', text: 'Raw rice grains look a little see-through.\nAfter a few minutes in hot oil they turn solid, chalky white.' },
      'damp-towel': { term: 'Damp towel', text: 'Wet a clean kitchen towel and wring it out hard.\nIt should feel damp, not dripping.' },
      'coldest': { term: 'Coldest spot', text: 'The bottom shelf of the fridge, at the back.' },
      'broiler': { term: 'Broiler', text: 'The heating element at the top of the oven. It cooks from above with very high heat.\nSet the oven to Broil, High.\nThe food goes on a rack near the top.\nIn some gas ovens the broiler is a drawer under the oven instead.' },
      'shred': { term: 'Shred cabbage', text: 'Cut the cabbage into wedges through the core.\nCut the hard core off a wedge.\nLay the wedge flat and slice across it as thin as you can.\nThe slices fall into ribbons.' },
      'shuck': { term: 'Husk corn', text: 'Peel the green leaves down and snap them off at the bottom.\nPull off the silky threads.' },
      'crumble': { term: 'Crumble', text: 'Break it into small bits with your fingers.' },
      'spoons': { term: 'Measuring spoons', text: 'Use the set of measuring spoons, not the spoons you eat with.\nEach one is stamped with its size.\nTBSP or 15 mL is the tablespoon. It is the biggest.\nTSP or 5 mL is the teaspoon.\nThe smaller ones say ½ and ¼.\nFill the spoon. Scrape it level with the back of a knife.\n1½ teaspoons means one 1 teaspoon plus one ½ teaspoon.\n3 teaspoons make 1 tablespoon. 4 tablespoons make ¼ cup.' },
      'pinch': { term: 'Pinch', text: 'What you can pick up between your thumb and two fingers.' },
      'strainer': { term: 'Strainer', text: 'A bowl full of holes, also called a colander.\nSet it in the sink. Liquid runs through. The food stays.' },
      'clove': { term: 'Garlic clove', text: 'A whole garlic is called a head. Do not use the whole head.\nBreak off one segment. That is a clove.\nPress down on it with the bottom of a mug until it cracks.\nPeel off the papery skin. Cut off the hard end.' },
      'cilantro': { term: 'Cilantro or parsley?', text: 'You have 2 bunches of cilantro and 1 bunch of parsley. They look alike.\nCilantro leaves are rounded and soft. Rub one. It smells sharp and strong.\nParsley leaves are pointed and darker. It smells mild.\nThe band or twist tie often names the herb.' },
      'knife': { term: 'Cutting safely', text: 'Put a damp paper towel under the cutting board so it cannot slide.\nCut anything round in half first. Lay the flat side down so it cannot roll.\nHold the food with your fingertips curled under. Your knuckles face the blade.\nCut slowly. Never try to catch a falling knife.' },
      'sear': { term: 'Sear', text: 'Cook fast in a very hot pan so the outside browns.\nLay the food down. Do not move it until it is time to turn it.' }
    },

    /* ----------------------------------------------------------------- tonight */
    tonight: [
      {
        id: 'tn-cold', title: 'Fish and shrimp into the fridge',
        body: [
          'Halibut: bottom shelf, at the back. That is the coldest spot.',
          'Keep it in its wrapper, on a plate.',
          'Shrimp: same shelf.'
        ]
      },
      {
        id: 'tn-beans', title: 'Soak the beans tonight (3 minutes)', sets: { soaked: true },
        body: [
          'Pour half the bag of pinto beans (about 1¼ cups) onto a plate.',
          'Pick out any pebbles or shriveled beans.',
          'Rinse the beans in a strainer.',
          'Put them in a big bowl with 4 cups of cold water. Leave it on the counter.',
          'Do this one. With the soak, the beans are done with more than an hour to spare.',
          'Without it there is a 1-hour shortcut. It uses up almost all the spare time in your morning.',
          'The beans may then have to finish cooking at her place.'
        ]
      },
      {
        id: 'tn-ice', title: 'Ice packs into the freezer',
        body: [
          'You need them frozen for the cooler tomorrow afternoon.',
          'No ice packs? Buy a bag of ice on your way home tomorrow.'
        ]
      },
      {
        id: 'tn-cooler', title: 'Find your cooler and a box for the gear',
        body: [
          'The cooler has to hold the big bean tub, about 10 jars, the fish, the shrimp and the ice.',
          'No cooler? A sturdy box lined with a trash bag works. Buy 2 bags of ice tomorrow.',
          'The gear is about 20 things. Find a box, a laundry basket or two strong bags for it.'
        ]
      },
      {
        id: 'tn-her', title: 'Text her 3 questions',
        body: [
          'Does your oven broiler work?',
          'Do you have a microwave?',
          'Can you clear a fridge shelf? Two big bowls have to fit.',
          'Ask what she has from the gear list. Leave those things at home.'
        ]
      },
      {
        id: 'tn-jars', title: 'Find 10 jars or tubs, 1 big tub, 3 zip bags',
        body: [
          'All with lids that seal. They ride in a cooler.',
          '1 quart jar (4 cups) for the pickled onions.',
          '5 jars or tubs that hold about 2 cups: slaw dressing, rice broth, rice purée, corn sauce, and one spare.',
          '4 small jars or tubs, about 1 cup each: two for lime juice, one for the marinade, one for the pink sauce.',
          '1 big tub, 2 quarts (8 cups), for the beans.',
          '3 zip bags: one for the rice, two for the fish and the shrimp in the cooler.',
          'Short on jars? A mug covered tightly with foil works, packed upright.'
        ]
      },
      {
        id: 'tn-pantry', title: 'Check the pantry',
        body: [
          'You said you have these. Look now.',
          'Salt, black pepper, whole peppercorns, sugar, bay leaves.',
          'Ground cumin, chipotle powder, dried Mexican oregano.',
          'White vinegar, vegetable oil, olive oil, sriracha, chicken broth, white rice.',
          'Also find: a can opener and an oven mitt.',
          'Something missing? Buy it tonight if you can.'
        ]
      },
      {
        id: 'tn-avocado', title: 'Check the avocados',
        body: [
          'Squeeze one gently.',
          'If it gives a little, put both in the fridge.',
          'Rock hard? Leave them on the counter in a paper bag.'
        ]
      },
      {
        id: 'tn-phone', title: 'Charge your phone. Set Auto-Lock to Never.',
        body: [
          'The timers cannot ring while the phone is locked.',
          'Keep the screen on: Settings, Display & Brightness, Auto-Lock, Never.',
          'Low Power Mode off. It forces the screen to lock after 30 seconds.',
          'Turn the ringer on and the volume up so you hear the timers.'
        ]
      }
    ],

    /* ------------------------------------------------------------------- steps */
    steps: [

      /* These sit at the top on purpose: the moment he is in her kitchen they outrank everything else. */
      {
        id: 'hers-unpack', dish: 'day', block: 'hers', where: 'hers',
        title: 'Unpack the cold things first',
        body: [
          'Empty the whole cooler into her fridge.',
          'That is the fish, the shrimp, the beans, every jar and tub, the cheese, the herbs, the carrots and the wrapped onions.',
          'The fish goes in the [[coldest|coldest spot]]: bottom shelf, at the back.',
          'Keep one shelf clear if you can. Two large bowls go in later.',
          'Leave the dry bag and the gear on the counter.'
        ],
        mins: 5
      },
      {
        id: 'beans-resume', dish: 'patron', block: 'hers', where: 'hers', when: { beansLater: true },
        title: 'Put the beans back on the stove',
        body: [
          'Pour the beans and all their liquid into a pot.',
          'Burner on [[heat|medium]]. No lid yet.',
          'Tap Done now. A 12-minute timer starts.',
          'The guide calls you back when the beans should be bubbling.'
        ],
        need: ['Bean tub', 'Pot with a lid'],
        wait: { id: 'beans-reboil', mins: 12, label: 'Beans heating up', attended: true, urgent: true },
        mins: 3
      },
      {
        id: 'beans-resume-low', dish: 'patron', block: 'hers', where: 'hers', when: { beansLater: true },
        title: 'Turn the beans down again',
        body: [
          'Look in the bean pot. Steady bubbles? Turn the burner down to [[heat|medium-low]].',
          'Put the lid on, [[lid-ajar|slightly open]].'
        ],
        look: 'A [[simmer]]: a few lazy bubbles every second.',
        tip: 'Not bubbling yet? Turn the heat up a notch and give it 3 more minutes.',
        after: ['beans-resume'],
        afterWait: 'beans-reboil',
        mins: 1
      },
      {
        id: 'hers-setup', dish: 'day', block: 'hers', where: 'hers', kind: 'checklist',
        title: 'Set up her kitchen',
        body: ['Find these now. Use the ones you brought if she does not have them.'],
        items: [
          '2 large bowls (ceviche, slaw)',
          '2 medium bowls (fish, raw shrimp). The fish bowl must be glass or stainless steel.',
          '1 clean serving bowl and a sheet of foil, next to the stove (cooked shrimp)',
          '3 small bowls',
          '1 plate (cheese)',
          'Strainer, sitting in the sink',
          'Cutting board and knife',
          'A damp paper towel under the cutting board, so it cannot slide',
          'Sheet pan lined with foil',
          'Saucepan with a tight lid that holds 6 to 8 cups (rice)',
          'Pot with a lid (beans)',
          'Cast-iron skillet',
          'Tongs, wooden spoon, fork',
          'Measuring spoons and measuring cups',
          'Oven mitt',
          'Paper towels, foil, 2 kitchen towels',
          'Oven: open it and take out anything stored inside',
          'Oven: find the Broil setting. Look for the broiler at the top, inside the oven. Nothing there? It is the drawer under the oven, and the corn pan goes in that drawer.',
          'Oven: move a rack to about 6 inches below the top now, while it is cold'
        ],
        mins: 8
      },

      /* ============================== MORNING, HIS KITCHEN ============================== */
      {
        id: 'beans-q', dish: 'patron', block: 'am', where: 'either', kind: 'choice',
        title: 'Did the beans soak overnight?',
        body: [
          'If you covered them with water last night, tap Yes.',
          'If not, tap No. There is a 1-hour shortcut. The beans may have to be finished at her place.'
        ],
        choice: { opt: 'soaked', options: [
          { label: 'Yes, they soaked', value: true },
          { label: 'No, they did not', value: false }
        ] },
        mins: 0.5
      },
      {
        id: 'beans-drain', dish: 'patron', block: 'am', where: 'either', when: { soaked: true },
        title: 'Drain the beans',
        body: [
          'Pour the beans into the [[strainer]] in the sink.',
          'Rinse them under cold water for a few seconds.'
        ],
        need: ['Soaked beans', 'Strainer'],
        after: ['beans-q'],
        mins: 2
      },
      {
        id: 'beans-sort', dish: 'patron', block: 'am', where: 'either', when: { soaked: false },
        title: 'Sort and rinse the beans',
        body: [
          'Pour half the bag of beans (about 1¼ cups) onto a plate.',
          'Pick out any pebbles or shriveled beans.',
          'Rinse the beans in the [[strainer]].'
        ],
        need: ['Plate', 'Strainer'],
        after: ['beans-q'],
        mins: 3
      },
      {
        id: 'beans-qs-heat', dish: 'patron', block: 'am', where: 'either', when: { soaked: false },
        title: 'Quick soak: beans and water on high',
        body: [
          'Put the beans in the big pot.',
          'Add 4 cups of water.',
          'Lid on. Burner on high.',
          'Tap Done now. The guide calls you back in 9 minutes, when it should be at a [[boil|full boil]].'
        ],
        need: ['Big pot with a lid', 'Measuring cup'],
        tip: 'If foam lifts the lid, turn the burner down a little and leave the lid [[lid-ajar|slightly open]].',
        after: ['beans-sort'],
        wait: { id: 'qs-boil', mins: 9, label: 'Beans coming to a boil', attended: true, urgent: true },
        mins: 2
      },
      {
        id: 'am-setup', dish: 'day', block: 'am', where: 'home', kind: 'checklist',
        title: 'Set out your gear',
        body: ['Get these out now, so you are not hunting for them with messy hands.'],
        items: [
          'Your phone: plugged in. Settings, Display & Brightness, Auto-Lock, Never. Low Power Mode off. Ringer on, volume up. The timers cannot ring while the phone is locked.',
          'Big heavy pot with a lid (beans)',
          'Skillet (oregano, then bacon)',
          'Medium pot with a lid (onion water)',
          'Strainer, sitting in the sink',
          'Cutting board and your sharpest knife',
          'A damp paper towel under the cutting board, so it cannot slide',
          'Kitchen scissors',
          'Tongs and a slotted spoon',
          'Wooden spoon or another long spoon (stirring)',
          'Measuring cups and measuring spoons',
          'Can opener',
          'Blender',
          'Lime squeezer',
          'Fine grater or vegetable peeler',
          'A ceramic coffee mug (bacon fat)',
          'A bowl and a plate (poblano)',
          'A second plate, lined with a paper towel (bacon)',
          '2 small bowls (pork; diced onion and poblano)',
          'Oven mitt or a thick dry towel (hot handles)',
          'Sheet pan and foil, only if your stove has no gas flame (poblano)',
          'Paper towels',
          'Jars and tubs with lids: 1 quart, 5 that hold 2 cups, 4 small. Plus the big bean tub and a zip bag.'
        ],
        mins: 6
      },
      {
        id: 'beans-pork', dish: 'patron', block: 'am', where: 'either',
        title: 'Cut the pork small',
        body: [
          'You need 2 ounces of pork. That is 3 or 4 chunks of the stew meat, a small handful.',
          'Snip each chunk into ½-inch pieces with kitchen scissors, into a small bowl. ½ inch is about the width of your little finger.',
          'Doing the quick soak? Cover the bowl and put it in the fridge. The pork goes in the pot in about an hour.',
          'No scissors? Cut it on a dinner plate, not on your cutting board.',
          'Wrap the rest of the pork and freeze it.'
        ],
        need: ['Stew pork', 'Kitchen scissors', 'Small bowl'],
        warn: 'Raw pork. Wash your hands, the scissors and the plate with hot soapy water.',
        mins: 3
      },
      {
        id: 'beans-qs-boil', dish: 'patron', block: 'am', where: 'either', when: { soaked: false },
        title: 'Boil the beans for 2 minutes',
        body: [
          'Lift the lid. The pot should be at a [[boil|full boil]]. If not, wait until it is.',
          'Leave the lid off. Start the timer.',
          'When it ends: burner off, lid on. Do not drain.',
          'The beans rest in the hot water for 1 hour.'
        ],
        after: ['beans-qs-heat'],
        afterWait: 'qs-boil',
        timer: { secs: 120, label: 'Beans boiling' },
        wait: { id: 'qs-stand', mins: 60, label: 'Beans resting in hot water', attended: false, urgent: true },
        mins: 0.5
      },
      {
        id: 'beans-qs-drain', dish: 'patron', block: 'am', where: 'either', when: { soaked: false },
        title: 'Drain the rested beans',
        body: [
          'Pour the beans into the [[strainer]] in the sink.',
          'Rinse out the pot.'
        ],
        after: ['beans-qs-boil'],
        afterWait: 'qs-stand',
        mins: 2
      },
      {
        id: 'beans-pot', dish: 'patron', block: 'am', where: 'either',
        title: 'Fill the bean pot',
        body: [
          'Into the big pot: the drained beans, 3½ cups of water, ½ cup of beer, and the pork.',
          'Cap the rest of the beer or drink it.'
        ],
        need: ['Drained beans', 'Measuring cup', 'Beer', 'Pork (in the fridge if you cut it earlier)'],
        into: 'Big pot',
        after: ['beans-drain', 'beans-qs-drain', 'beans-pork'],
        mins: 3
      },
      {
        id: 'beans-heat', dish: 'patron', block: 'am', where: 'either',
        title: 'Beans on medium heat',
        body: [
          'Burner on [[heat|medium]]. No lid yet.',
          'Tap Done now. A 12-minute timer starts.',
          'Go on to the next step while it heats. The guide calls you back.'
        ],
        after: ['beans-pot'],
        wait: { id: 'beans-boil', mins: 12, label: 'Beans coming to a boil', attended: true, urgent: true },
        mins: 1
      },
      {
        id: 'onion-water', dish: 'blanch', block: 'am', where: 'either',
        title: 'Put the onion water on',
        body: [
          'Fill a medium pot with 5 cups of water.',
          'Lid on. Burner on high.'
        ],
        need: ['Medium pot with a lid'],
        wait: { id: 'onion-water', mins: 8, label: 'Onion water heating', attended: true, urgent: false },
        mins: 1
      },
      {
        id: 'onion-slice', dish: 'blanch', block: 'am', where: 'either',
        title: 'Slice 1½ red onions',
        body: [
          '[[knife|First cut of the day. Read how to cut safely.]]',
          'Take 2 red onions. Cut a thin slice off both ends of each one.',
          'Stand each onion on a cut end. Cut it in half from top to bottom. Peel off the papery skin. You now have 4 halves.',
          'Wrap 1 half and put it in the fridge. It is for the slaw. Your onions are large, so the other 3 halves are enough.',
          'Lay each of those 3 halves flat side down. Slice across it into thin [[half-moons]].',
          'Leave the slices on the board.'
        ],
        need: ['2 red onions', 'Cutting board', 'Knife'],
        look: 'Slices about as thick as a coin.',
        mins: 6
      },
      {
        id: 'oregano-toast', dish: 'blanch', block: 'am', where: 'either',
        title: 'Toast the oregano',
        body: [
          'Put the dry skillet on [[heat|medium-high]]. No oil.',
          'Let it heat until a drop of water sizzles in it. That takes a minute or two.',
          'Add 1 [[spoons|teaspoon]] of dried Mexican oregano. Start the timer. Keep it moving: shake the pan or stir with a spoon.',
          'When the timer ends or it smells strong, tip or spoon it straight into the quart jar. [[toast|It burns fast.]]',
          'Burner off.'
        ],
        need: ['Skillet', 'Spoon', 'Mexican oregano', 'Quart jar'],
        into: 'Onion jar',
        look: 'You can smell it from a step away. No smoke.',
        timer: { secs: 30, label: 'Oregano toasting' },
        mins: 3
      },
      {
        id: 'beans-simmer', dish: 'patron', block: 'am', where: 'either',
        title: 'Turn the beans down',
        body: [
          'Look in the bean pot. When you see steady bubbles, turn the burner down to [[heat|medium-low]].',
          'You want a [[simmer]]: a few small bubbles, not a hard boil.',
          'Gray foam on top is normal. Skim it off with a spoon or leave it.',
          'Put the lid on, [[lid-ajar|slightly open]].',
          'Stir them now and then. The guide will remind you. If beans poke above the liquid, add a splash of water.'
        ],
        look: 'A few lazy bubbles every second.',
        tip: 'Not bubbling yet? Turn the heat up a notch and give it 3 more minutes.',
        after: ['beans-heat'],
        afterWait: 'beans-boil',
        wait: { id: 'simmer', mins: 60, label: 'Beans simmering', attended: true, urgent: false, laps: [20, 40], lapLabel: 'Stir the beans. Add water if they poke out' },
        mins: 1
      },
      {
        id: 'onion-blanch', dish: 'blanch', block: 'am', where: 'either',
        title: 'Dunk the onions in hot water',
        body: [
          'The water should be at a [[boil|full boil]].',
          'Slide all the sliced onions in. Turn the burner off.',
          'Start the timer. You like strong onion flavor, so 30 seconds is enough.',
          'When it ends, pour everything through the [[strainer]] in the sink.',
          '[[blanch|This is called blanching.]]'
        ],
        need: ['Sliced onions', 'Strainer in the sink'],
        look: 'The onions bend but still have a little crunch.',
        tip: 'For milder onions next time, leave them in for 2 minutes.',
        warn: 'Boiling water and steam. Lower the onions in gently. Carry the pot with both hands. Pour slowly, away from you. Keep your face back.',
        after: ['onion-slice', 'onion-water'],
        afterWait: 'onion-water',
        timer: { secs: 30, label: 'Onions in hot water' },
        mins: 2
      },
      {
        id: 'onion-jar', dish: 'blanch', block: 'am', where: 'either',
        title: 'Fill the onion jar',
        body: [
          'Into the quart jar with the oregano: the drained onions, ½ cup of white vinegar and ½ cup of water.',
          'Add 2 allspice berries, 3 black peppercorns, 1 bay leaf and ½ teaspoon of salt.',
          'Lid on. Shake. Into the fridge.'
        ],
        need: ['White vinegar', 'Allspice berries', 'Peppercorns', 'Bay leaf', 'Salt'],
        into: 'Onion jar',
        look: 'They turn bright pink over the next 2 hours.',
        tip: 'The liquid does not cover the onions at first. Press them down with a spoon. Shake the jar again each time you open the fridge.',
        after: ['onion-blanch', 'oregano-toast'],
        mins: 4
      },
      {
        id: 'poblano-char', dish: 'patron', block: 'am', where: 'either',
        title: 'Blacken the poblano',
        body: [
          'You are [[char|burning the skin on purpose]].',
          'Gas stove: turn a burner to high. Lay the chile on the metal grate, right in the flame.',
          'Turn it with tongs every 30 seconds until the skin is black and blistered all over, 5 to 8 minutes.',
          'No gas flame: move an oven rack to about 4 inches below the top element. Turn the [[broiler]] to high.',
          'Put the chile on a foil-lined pan on that rack. Turn it with tongs every 2 to 3 minutes, about 10 minutes. Use an oven mitt.',
          'Drop the hot chile in a bowl and cover the bowl with a plate. Burner or broiler off.'
        ],
        need: ['Poblano (labeled pasilla)', 'Tongs', 'Bowl and plate', 'No gas flame: foil-lined pan and oven mitt'],
        look: 'Black on every side. No big green patches.',
        tip: 'The skin may pop or catch small flames. That is normal. Keep turning.',
        warn: 'Open flame. Keep sleeves, towels and paper away from it. Turn on the fan over the stove.',
        wait: { id: 'poblano-steam', mins: 5, label: 'Poblano steaming', attended: false, urgent: false },
        mins: 8
      },
      {
        id: 'bacon-cut', dish: 'patron', block: 'am', where: 'either',
        title: 'Cut the bacon',
        body: [
          'Take 4 slices of bacon.',
          'Snip them with kitchen scissors into ½-inch pieces, straight into the cold skillet.',
          'No scissors? Stack the slices on a dinner plate and cut them with a knife.',
          'Wrap the rest of the bacon. Fridge or freezer.'
        ],
        need: ['Bacon', 'Kitchen scissors', 'Skillet'],
        warn: 'Raw pork. Wash your hands and the scissors with hot soapy water.',
        mins: 3
      },
      {
        id: 'bacon-fry', dish: 'patron', block: 'am', where: 'either',
        title: 'Start the bacon',
        body: [
          'Burner on [[heat|medium-low]] under the skillet.',
          'Tap Done now. A 10-minute timer starts.',
          'Stir the bacon now and then while you do the next steps. The guide will remind you.'
        ],
        after: ['bacon-cut'],
        wait: { id: 'bacon', mins: 10, label: 'Bacon frying', attended: true, urgent: true, laps: [4, 7], lapLabel: 'Stir the bacon' },
        mins: 1
      },
      {
        id: 'sofrito-onion', dish: 'patron', block: 'am', where: 'either',
        title: 'Dice a wedge of white onion',
        body: [
          'Your white onions are jumbo, so a quarter of one equals the recipe\'s half onion.',
          'Cut a thin slice off both ends of one onion. Stand it on a cut end. Cut it in half from top to bottom.',
          'Lay each half flat side down and cut it in half again. Peel the 4 wedges.',
          '[[dice|Dice]] one wedge into small pieces, about ¼ inch.',
          'Wrap the other three wedges. One is for the rice purée. One goes to her place for the ceviche.'
        ],
        need: ['1 white onion', 'Cutting board', 'Knife'],
        into: 'Small bowl. The chopped poblano joins it later.',
        mins: 5
      },
      {
        id: 'tomato-drain', dish: 'patron', block: 'am', where: 'either',
        title: 'Drain half the can of tomatoes',
        body: [
          'Open the plain diced tomatoes. Not the fire-roasted can.',
          'Pour about half the can into the [[strainer]] over the sink. Let it drip.',
          'They are already cut small, so no chopping.',
          'You do not need the other half. Fridge it or toss it.'
        ],
        need: ['Plain diced tomatoes', 'Can opener', 'Strainer'],
        mins: 2
      },
      {
        id: 'poblano-peel', dish: 'patron', block: 'am', where: 'either',
        title: 'Peel and chop the poblano',
        body: [
          'Rub the black skin off with your fingers or a paper towel.',
          'Do not rinse it. Water washes away the smoky flavor.',
          'Pull off the stem. Tear the chile open and scrape out the seeds.',
          'Chop it into ½-inch pieces.'
        ],
        into: 'The small bowl with the diced white onion',
        look: 'A few black flecks left on it are fine.',
        after: ['poblano-char'],
        afterWait: 'poblano-steam',
        mins: 4
      },
      {
        id: 'bacon-out', dish: 'patron', block: 'am', where: 'either',
        title: 'Take the bacon out',
        body: [
          'The bacon should be brown and crisp. If it is still soft, give it 2 more minutes.',
          'Burner off.',
          'Lift the bacon out with the slotted spoon onto a plate lined with a paper towel.',
          'The skillet handle is hot. Touch it only with an oven mitt or a folded dry towel.',
          'Do not pour. Do not lift or tilt the hot skillet. Spoon the hot [[bacon-fat|fat]] out of it into the mug.',
          'Spoon 1 tablespoon of the fat back into the skillet.'
        ],
        need: ['Slotted spoon', 'Spoon', 'Plate with a paper towel', 'Heatproof mug', 'Oven mitt or dry towel'],
        warn: 'Hot fat burns. Keep it away from the flame. Never pour it down the drain. Let it harden in the mug, then bin it.',
        after: ['bacon-fry'],
        afterWait: 'bacon',
        mins: 3
      },
      {
        id: 'sofrito-fry', dish: 'patron', block: 'am', where: 'either',
        title: 'Fry the onion and poblano',
        body: [
          'Burner on [[heat|medium]] under the skillet with the bacon fat.',
          'Add the diced white onion and the chopped poblano.',
          'Start the timer. Stir every minute or so.'
        ],
        look: 'The onion is [[golden|deep golden]], brown at the edges.',
        tip: 'This is a half batch in a big pan, so it can brown early. Brown at the edges before the timer ends? Stop and go on. Darkening fast? Turn the burner down to [[heat|medium-low]]. Still pale when the timer ends? Give it 2 more minutes.',
        after: ['bacon-out', 'sofrito-onion', 'poblano-peel'],
        timer: { secs: 480, label: 'Onion and poblano' },
        mins: 1
      },
      {
        id: 'sofrito-tomato', dish: 'patron', block: 'am', where: 'either',
        title: 'Add the tomatoes and cook them dry',
        body: [
          'Add the drained tomatoes to the skillet.',
          'Keep stirring until the watery liquid is gone, 4 to 6 minutes.',
          'Burner off. Leave it in the skillet.'
        ],
        look: '[[cook-dry|Drag the spoon across the pan.]] No liquid runs back into the path.',
        after: ['sofrito-fry', 'tomato-drain'],
        mins: 6
      },
      {
        id: 'beans-check', dish: 'patron', block: 'am', where: 'either', kind: 'check',
        title: 'Are the beans tender?',
        body: [
          'Fish out 3 beans with a spoon. Let them cool for 30 seconds. They are very hot.',
          'Press each one against the roof of your mouth with your tongue.',
          'Tender means all 3 mash easily, like a soft potato. No hard or chalky center.',
          'If even one is firm, tap Still firm. Beans soften much more slowly once the tomato mix goes in.',
          'Not there yet is normal. Beans can need 90 minutes or more, and longer if they did not soak overnight.',
          'While you are there: stir, and add a splash of water if beans poke above the liquid.'
        ],
        after: ['beans-simmer', 'beans-resume-low'],
        afterWait: 'simmer',
        check: {
          yes: 'Tender', no: 'Still firm', retryMins: 15,
          giveUp: { label: 'No time. Finish them at her place.', set: { beansLater: true }, withinMinsOf: { anchor: 'leaveAm', mins: 50 } }
        },
        mins: 2
      },
      {
        id: 'beans-pause', dish: 'patron', block: 'am', where: 'home', must: true, when: { beansLater: true, beansStored: false },
        title: 'Stop the beans for now',
        body: [
          'Turn the burner off.',
          'Scoop the beans and all their liquid into the big bean tub with a ladle or a mug. They are boiling hot, so do not pour from the pot.',
          'Lid on. Into the fridge, on a high shelf. Not next to the fish.',
          'Tomato mix or bacon not in the beans yet? Put them in the spare tub. Lid on. Fridge. It comes with you.',
          'You will finish the beans at her place.'
        ],
        into: 'Bean tub',
        after: ['beans-heat'],
        mins: 3
      },
      {
        id: 'beans-add', dish: 'patron', block: 'am', where: 'either', must: true,
        title: 'Add the good stuff to the beans',
        body: [
          'Scrape the onion, poblano and tomato mix into the bean pot. It is in the skillet, or in the spare tub if you packed it.',
          'Add the bacon, if it is not already in with the mix, and ½ teaspoon of salt. Stir.',
          'Keep it at a [[simmer]] with the lid [[lid-ajar|slightly open]].'
        ],
        after: ['beans-check', 'sofrito-tomato', 'bacon-out', 'beans-resume-low'],
        wait: { id: 'beans-final', mins: 25, label: 'Beans: last simmer', attended: true, urgent: false, laps: [12], lapLabel: 'Stir the beans' },
        mins: 2
      },
      {
        id: 'beans-off', dish: 'patron', block: 'am', where: 'either',
        title: 'Taste the beans. They are done.',
        body: [
          'Taste a spoonful of beans and broth. Flat? Add a [[pinch]] of salt, stir, and taste again. It can take 3 or 4 pinches.',
          'It should be brothy, like a thick soup.',
          'Too watery? Take the lid off. Turn the burner up to [[heat|medium]]. Let it bubble until it looks like a thick soup. Stir often.',
          'Burner off. Lid off so they cool for the fridge.',
          'At her place with less than 1 hour until dinner? Keep them hot instead. Lid on. Burner on its lowest setting.'
        ],
        tip: 'Optional, for a creamier broth: scoop 1 cup of the beans with a little liquid into a bowl. Mash them with a fork. Stir them back in.',
        after: ['beans-add', 'beans-resume-low'],
        afterWait: 'beans-final',
        wait: { id: 'beans-cool', mins: 25, label: 'Beans cooling', attended: false, urgent: false },
        mins: 3
      },
      {
        id: 'beans-store', dish: 'patron', block: 'am', where: 'home', must: true, when: { beansLater: false, beansStored: false },
        title: 'Beans into the fridge',
        body: [
          'Scoop the beans and all their liquid into the big bean tub with a ladle or a mug. The pot is heavy and hot, so do not pour from it.',
          'Lid on. Into the fridge, on a high shelf. Not next to the fish.',
          'They taste even better tonight.'
        ],
        into: 'Bean tub',
        after: ['beans-off'],
        afterWait: 'beans-cool',
        mins: 3
      },
      {
        id: 'beans-store-hers', dish: 'patron', block: 'hers', where: 'hers', when: { beansLater: true }, optional: true,
        title: 'Beans into her fridge',
        body: [
          'Scoop the beans and their liquid back into the bean tub with a ladle or a mug.',
          'Lid on. Into her fridge.',
          'You warm them up again just before dinner.',
          'Less than 1 hour until dinner? Skip this. Leave the pot on the stove with the lid on.'
        ],
        into: 'Bean tub',
        after: ['beans-off'],
        afterWait: 'beans-cool',
        mins: 3
      },
      {
        id: 'pink-sauce', dish: 'pink', block: 'am', where: 'either',
        title: 'Make the pink sauce',
        body: [
          'In a small tub: 6 [[spoons|tablespoons]] of sour cream and 1 tablespoon of sriracha.',
          'Stir until it is evenly pink. Taste it.',
          'Want more heat? Add up to 1½ teaspoons more sriracha.',
          'Lid on. Fridge.'
        ],
        need: ['Sour cream', 'Sriracha', 'Measuring spoons'],
        into: 'Pink sauce tub',
        mins: 4
      },
      {
        id: 'limes', dish: 'day', block: 'am', where: 'either',
        title: 'Zest half a lime, then juice eleven',
        body: [
          'Rinse one lime. First the [[zest]]: scrape the green skin off half of it into the marinade jar. Green only, not the white underneath.',
          'Now the juice. Roll each lime hard on the counter. Cut it in half across the middle.',
          'Squeeze each half in the squeezer, cut side facing down, over a medium bowl.',
          'Juice 11 limes. The zested lime is one of them. Pick out any seeds.',
          'Measure ¾ cup of the juice into the ceviche lime jar. Lid on. Fridge.',
          'Pour the rest (about ½ cup) into the sauce lime jar. Lid on. Fridge.',
          'The slaw dressing, the corn sauce and the marinade each use some. About 1 tablespoon will be left over.'
        ],
        need: ['11 limes (keep 4 whole)', 'Lime squeezer', 'Medium bowl', 'Measuring cup', 'Fine grater or vegetable peeler', 'Cutting board and knife'],
        into: 'Ceviche lime jar, sauce lime jar and marinade jar',
        tip: 'Less than ½ cup left for the sauce lime jar? Juice 1 or 2 of the 4 whole limes too. Keep 2 whole for the wedges.',
        mins: 18
      },
      {
        id: 'slaw-dressing', dish: 'cream', block: 'am', where: 'either',
        title: 'Shake up the slaw dressing',
        body: [
          'Into one of the 2-cup jars: ½ cup of mayonnaise, ½ cup of Greek yogurt and ¼ cup of lime juice.',
          'Add 2 tablespoons of sugar, 1 teaspoon of ground cumin and 1 teaspoon of chipotle powder.',
          'Lid on tight. Shake until smooth. Fridge.'
        ],
        need: ['Mayonnaise', 'Greek yogurt', 'Sauce lime jar', 'Sugar', 'Cumin', 'Chipotle powder'],
        into: 'Slaw dressing jar',
        after: ['limes'],
        mins: 6
      },
      {
        id: 'corn-sauce', dish: 'elote', block: 'am', where: 'either',
        title: 'Stir the corn sauce',
        body: [
          'In one of the 2-cup tubs: ½ cup of sour cream, ¼ cup of mayonnaise and 1 tablespoon of lime juice.',
          'Stir until smooth. Lid on. Fridge.'
        ],
        need: ['Sour cream', 'Mayonnaise', 'Sauce lime jar'],
        into: 'Corn sauce tub',
        after: ['limes'],
        mins: 3
      },
      {
        id: 'marinade', dish: 'pink', block: 'am', where: 'either',
        title: 'Make the shrimp marinade',
        body: [
          'The marinade jar already holds the lime zest. Add 2 tablespoons of lime juice.',
          'Peel 1 [[clove|garlic clove]]. [[mince|Mince]] it and add it.',
          'Rinse a small handful of [[cilantro]] and shake it dry. Chop the leaves fine until you have 1 tablespoon. Add it.',
          'Add 2 tablespoons of olive oil.',
          'Add 1½ teaspoons of chipotle powder. For mild, use 1 teaspoon.',
          'Add ¼ teaspoon of salt and ¼ teaspoon of black pepper.',
          'Lid on. Shake. Fridge. The shrimp do not go in until tonight.'
        ],
        need: ['Sauce lime jar', 'Garlic', 'Cilantro', 'Chipotle powder', 'Olive oil', 'Salt', 'Pepper'],
        into: 'Marinade jar',
        after: ['limes'],
        mins: 8
      },
      {
        id: 'rice-puree', dish: 'milky', block: 'am', where: 'home',
        title: 'Blend the rice purée',
        body: [
          'Open the fire-roasted tomatoes. Spoon half the can into the blender. Leave most of the watery juice behind.',
          'Add a chunk of white onion about the size of a ping-pong ball, cut in 3 or 4 pieces. Cut it from one of your wedges.',
          'Add 1 peeled [[clove|garlic clove]], cut in half.',
          '[[puree|Blend until completely smooth.]]',
          'Pour it into the purée jar. Use one of the 2-cup jars. Lid on. Fridge. Rinse the blender right away.'
        ],
        need: ['Fire-roasted tomatoes', 'White onion wedge', 'Garlic', 'Blender'],
        into: 'Purée jar',
        tip: 'Blender just spinning? Stop it first. Push the tomatoes down with a spoon. Add 1 tablespoon of the juice from the can. Blend again.',
        mins: 6
      },
      {
        id: 'rice-kit', dish: 'milky', block: 'am', where: 'home',
        title: 'Pack the rice kit',
        body: [
          'Measure ¾ cup of white rice into the zip bag. Do not rinse it.',
          'Measure ¾ cup plus 2 tablespoons of chicken broth into the broth jar. Use one of the 2-cup jars.',
          'Add ¼ teaspoon of salt plus a [[pinch]] to that jar. Use ¾ teaspoon if your broth says unsalted.',
          'Lid on. Broth jar in the fridge. Rice bag by the door.'
        ],
        need: ['White rice', 'Chicken broth', 'Salt', 'Measuring cup'],
        into: 'Zip bag and broth jar',
        mins: 3
      },
      {
        id: 'am-clean', dish: 'day', block: 'am', where: 'home', optional: true, when: { beansStored: false },
        title: 'Wash what goes to her place',
        body: [
          'Wash by hand and dry the things that go to her place: the skillet, the strainer, the cutting board, the knife, the tongs, the wooden spoon, the measuring cups and spoons.',
          'Cast-iron skillet: hot water and a brush. Dry it right away. No dishwasher.',
          'Wash the medium pot and its lid. It goes to her place for the beans.',
          'Still using one of them? Leave it. Wash it when it is free.',
          'Everything else goes in the sink or the dishwasher. Wipe the counters.',
          'Turn off every burner you are not using. Beans still cooking? Leave that burner on.'
        ],
        mins: 12
      },
      {
        id: 'pack-gear', dish: 'day', block: 'am', where: 'home', kind: 'checklist', must: true,
        title: 'Stack the gear by the door',
        body: [
          'Bring everything on this list unless you know she has it.',
          'Not sure what she has? Text her now. Ask too: does the oven broiler work? Is there room in the fridge for two big bowls?',
          'Wash and dry anything you cooked with this morning.',
          'Still using the skillet or a spoon? Leave it out. Wash it and add it when it is free.',
          'Put the rest in a box, a laundry basket or two strong bags.'
        ],
        items: 'gear',
        mins: 8
      },
      {
        id: 'pack-bag', dish: 'day', block: 'am', where: 'home', kind: 'checklist', must: true,
        title: 'Pack the dry bag',
        body: [
          'Everything here is fine without a fridge. Put the bag by the door.',
          'Beans still cooking? Keep the salt out until they are done.',
          'Find your cooler now. It has to hold the big bean tub, about 10 jars, the fish, the shrimp and the ice.'
        ],
        items: 'bag',
        mins: 7
      },
      {
        id: 'm-leave-am', dish: 'day', block: 'am', where: 'home', kind: 'move', move: 'leaveAm',
        title: 'Leave for your appointment',
        body: [
          'Before you walk out:',
          'Every burner is off. The oven is off.',
          'Beans still in the pot? Scoop them and all their liquid into the big bean tub with a ladle or a mug. Lid on.',
          'The bean tub goes in the fridge, on a high shelf. Not next to the fish. Hot is fine.',
          'Tomato mix or bacon not in the beans yet? Put them in the spare tub. Lid on. Fridge.',
          'Nothing that needs a fridge is on the counter or the stove: sour cream, yogurt, mayonnaise, broth, bacon, pork, every jar and tub you filled.'
        ],
        mins: 0
      },

      /* ============================== LOAD UP, HIS KITCHEN ============================== */
      {
        id: 'm-back', dish: 'day', block: 'load', where: 'home', kind: 'move', move: 'backHome',
        title: 'Back home',
        body: ['You have about 30 minutes to load up.'],
        mins: 0
      },
      {
        id: 'pack-cooler', dish: 'day', block: 'load', where: 'home', kind: 'checklist', must: true,
        title: 'Pack the cooler',
        body: [
          'Put the halibut and the shrimp each in a zip bag and seal it. No zip bags? Use plastic bags and tie them shut.',
          'Ice packs on the bottom. Fish and shrimp right on the ice.',
          'Jars stand upright. Herbs, carrots and cheese go on top.'
        ],
        items: 'cooler',
        after: ['m-back'],
        mins: 10
      },
      {
        id: 'pack-car', dish: 'day', block: 'load', where: 'home', kind: 'checklist', must: true,
        title: 'Load the car',
        body: ['One last look. Anything here still dirty or still in the kitchen? Wash it and add it now.'],
        items: [
          'Cooler',
          'Dry bag, with the salt and the rice in it',
          'Gear',
          'Cast-iron skillet is with the gear',
          'Medium pot and its lid are with the gear',
          'Wooden spoon, measuring spoons and measuring cups are with the gear'
        ],
        after: ['pack-cooler'],
        mins: 4
      },
      {
        id: 'm-leave-pm', dish: 'day', block: 'load', where: 'home', kind: 'move', move: 'leavePm',
        title: 'Drive to her place',
        body: ['Cooler, dry bag, gear. All three are in the car.'],
        mins: 0
      },
      {
        id: 'm-arrive', dish: 'day', block: 'load', where: 'hers', kind: 'move', move: 'arrive',
        title: 'You are at her place',
        body: ['Carry in the cooler first.'],
        mins: 0
      },

      /* ================================= HER KITCHEN ================================= */
      /* hers-unpack, the two bean steps and hers-setup are at the very top of this list. */
      {
        id: 'rinse-veg', dish: 'day', block: 'hers', where: 'hers',
        title: 'Wash your hands. Rinse the vegetables.',
        body: [
          'Wash your hands with soap.',
          'Rinse under cold water: the tomatoes, the serranos, the jalapeño, the scallions, the cilantro and the parsley.',
          'Shake them dry. Lay them on a clean kitchen towel.',
          'Peel the outer leaves off both cabbages and throw them away.'
        ],
        mins: 4
      },
      {
        id: 'chop-onion', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Dice the white onion',
        body: [
          'Take one of the white onion wedges you brought.',
          '[[dice|Dice]] it into small pieces, about ¼ inch.',
          'Put it in a medium bowl made of glass or stainless steel. Not aluminum: lime juice reacts with it.'
        ],
        into: 'Fish bowl (medium, glass or steel)',
        mins: 5
      },
      {
        id: 'chop-tomato', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Dice 2 tomatoes',
        body: [
          'Cut 2 Roma tomatoes in half the long way. Cut out the pale core at the stem end.',
          'Slice each half into strips, then cut across the strips.',
          'Pieces about ¼ inch. The juice and seeds go in the bowl too.'
        ],
        into: 'Ceviche bowl (large)',
        mins: 6
      },
      {
        id: 'chop-serrano', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Seed and chop 1 serrano',
        body: [
          'Serranos are the 4 thin chiles. The 1 fatter chile is the jalapeño.',
          'Cut the stem off 1 serrano. Slice it in half the long way.',
          '[[seed|Scrape out the seeds and the pale ribs]] with the tip of a spoon.',
          'Chop it as fine as you can.'
        ],
        into: 'Ceviche bowl',
        warn: 'Chile oil burns. Wash your hands with soap right after. Do not touch your eyes.',
        mins: 3
      },
      {
        id: 'chop-cilantro', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Chop the cilantro',
        body: [
          'Take the rinsed [[cilantro]]. Pat it dry with a paper towel.',
          'For the ceviche: chop leaves and thin stems until you have 2 tablespoons plus 2 teaspoons. Into the ceviche bowl.',
          'For the beans: [[chop|roughly chop]] more until you have ¼ cup. That is 4 tablespoons. Into a small bowl. Cover it. Fridge.',
          'Set a few nice leaves aside for the top of the ceviche. Wrap them in a damp paper towel. Fridge.'
        ],
        into: 'Ceviche bowl and a small bowl (bean cilantro)',
        mins: 6
      },
      {
        id: 'chop-olives', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Chop the olives',
        body: [
          'Chop green olives until you have 2 tablespoons plus 2 teaspoons. That is 8 to 10 olives.',
          'Into the ceviche bowl. Stir everything in the bowl together.',
          'Cover the bowl. Fridge.'
        ],
        into: 'Ceviche bowl',
        mins: 3
      },
      {
        id: 'chop-rice', dish: 'milky', block: 'hers', where: 'hers',
        title: 'Get the rice add-ins ready',
        body: [
          'Take 2 serranos. Leave them whole, but cut a [[slit]] down one side of each.',
          'Chop [[cilantro|parsley]] leaves until you have 2 tablespoons.',
          'Both go in one small bowl.'
        ],
        into: 'Small bowl (rice add-ins)',
        mins: 3
      },
      {
        id: 'chop-cabbage', dish: 'cream', block: 'hers', where: 'hers',
        title: 'Shred the cabbage',
        body: [
          'Stand the green cabbage on its stem end. Hold it at the side, away from the knife. Cut straight down through the middle.',
          'Lay each half flat side down. Cut each half in two through the core. You have 4 wedges.',
          'Cut the hard core off one wedge.',
          '[[shred|Slice that wedge across as thin as you can.]]',
          'Keep going until you have 4 cups, loosely packed. That is about a quarter of the head.',
          'Do the same with the purple cabbage until you have 1 cup.'
        ],
        need: ['Green cabbage', 'Purple cabbage', '1-cup measure'],
        into: 'Slaw bowl (large)',
        look: 'Thin ribbons, like coleslaw.',
        mins: 10
      },
      {
        id: 'chop-slaw-rest', dish: 'cream', block: 'hers', where: 'hers',
        title: 'Finish the slaw vegetables',
        body: [
          'Slice the half red onion as thin as you can.',
          'Trim the roots off 3 [[scallions]]. Slice them thin, white and green parts.',
          '[[seed|Seed]] the jalapeño and [[mince]] it.',
          'Add 1 cup of shredded carrots from the bag.',
          'Everything into the slaw bowl. Cover it. Fridge.'
        ],
        into: 'Slaw bowl',
        warn: 'Wash your hands with soap after the jalapeño.',
        mins: 8
      },
      {
        id: 'chop-limes', dish: 'pink', block: 'hers', where: 'hers',
        title: 'Cut 2 limes into wedges',
        body: [
          'Cut 2 limes. 1 is for the tacos. 1 is an extra for the corn and the ceviche.',
          'Cut each lime in half from tip to tip, then each half into 3 [[wedges]].',
          'Into a small bowl for the table.'
        ],
        into: 'Small bowl (lime wedges)',
        mins: 2
      },
      {
        id: 'prep-corn', dish: 'elote', block: 'hers', where: 'hers',
        title: 'Husk the corn. Crumble the cheese.',
        body: [
          '[[shuck|Pull the green husks and the silky threads off]] all 4 ears.',
          'Lay the corn on the foil-lined sheet pan.',
          '[[crumble|Crumble]] cotija cheese into the 1-cup measure until it is half full. Tip it onto a plate. Crumble a little extra on top.',
          'Cover the plate of cheese with foil. Fridge.'
        ],
        into: 'Sheet pan and plate',
        mins: 6
      },
      {
        id: 'fish-trim', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Smell the fish. Set one third aside.',
        body: [
          'With clean hands first: take the ceviche lime jar out of the fridge. Take its lid off. Tear off a sheet of foil for the fish bowl.',
          'Unwrap the halibut and smell it. Clean, like the sea, is right.',
          'You need ½ pound. That is about two-thirds of your fillet. The label shows the weight.',
          'Cut off the extra third. Wrap it. Leave it at the edge of the board for now.'
        ],
        need: ['Halibut', 'Ceviche lime jar, lid off', 'Foil', 'Paper towels'],
        warn: 'Sour or strongly fishy? Stop. Do not make ceviche with it.',
        after: ['chop-onion'],
        mins: 2
      },
      {
        id: 'fish-cube', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Cut the fish into ½-inch cubes',
        body: [
          '[[pat-dry|Pat the fish dry]] with paper towels.',
          'Skin on one side? Lay the fish skin-side down. At one end, cut down through the flesh until the knife touches the skin.',
          'Turn the blade flat. Hold the end of the skin with your other hand. Slide the knife along on top of the skin to the far end. Throw the skin away.',
          'Cut the fish into strips as wide as your little finger. That is ½ inch. Then cut across the strips every ½ inch.',
          'Look at each piece as you cut. A thin curled thread in the flesh is a fish worm. Cut that piece out and throw it away.',
          'Put the cubes in the fish bowl on top of the onion.'
        ],
        into: 'Fish bowl',
        after: ['fish-trim'],
        mins: 4
      },
      {
        id: 'fish-cure', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Cover the fish with lime juice',
        body: [
          'Pour the whole ceviche lime jar (¾ cup) over the fish and onion. Stir with a spoon.',
          'The fish should [[float|float freely]] in the juice.',
          'Cover the bowl with the foil.',
          'Wash your hands with soap.',
          'Now the bowl goes into the fridge. So does the wrapped leftover fish. Cook that tomorrow.',
          'The lime juice now [[cure|cures]] the fish. The first check is in 20 minutes. Thick cubes often need longer.'
        ],
        need: ['Ceviche lime jar', 'Spoon', 'Foil'],
        tip: 'Fish not covered by the juice? Move it all into a smaller, deeper bowl made of glass or stainless steel.',
        warn: 'Lime juice does not kill germs or parasites. The fish is still raw. Keep it in the fridge until it goes to the table.',
        after: ['fish-cube', 'limes'],
        wait: { id: 'cure', mins: 20, label: 'Fish curing', attended: false, urgent: true },
        mins: 2
      },
      {
        id: 'wash-up', dish: 'day', block: 'hers', where: 'hers',
        title: 'Wash up after the raw fish',
        body: [
          'Wash the cutting board, the knife and your hands with hot soapy water.',
          'Wipe the counter where the fish was. Wipe the fridge handle, the faucet and your phone screen too.'
        ],
        warn: 'Do this before you touch anything else.',
        after: ['fish-cure'],
        mins: 4
      },
      {
        id: 'fish-check', dish: 'scoop', block: 'hers', where: 'hers', kind: 'check',
        title: 'Is the fish ready?',
        body: [
          'Lift out the biggest cube with a fork. Break it in half on a plate.',
          'Ready means it is [[opaque|white all the way through]]. No shiny, see-through center.',
          'Still shiny in the middle? That is normal at first. It can take an hour or more.',
          'Not ready? Stir it, cover it, and put it back in the fridge.',
          'Still a little shiny 2 hours before dinner? Call it ready. A thin shiny line in the center is fine. Lime juice changes the texture, not the safety.'
        ],
        after: ['fish-cure'],
        afterWait: 'cure',
        check: { yes: 'White all the way', no: 'Still shiny inside', retryMins: 10 },
        mins: 1
      },
      {
        id: 'fish-drain', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Drain the fish',
        body: [
          'Pour the fish and onion into the [[strainer]] in the sink. Let the juice run away.',
          'Tip the fish and onion back into the bowl. Cover. Fridge.',
          'Wash the strainer, the fork and your hands with hot soapy water.'
        ],
        warn: 'Do not leave fish sitting in lime juice for hours. It turns mushy.',
        after: ['fish-check'],
        mins: 2
      },
      {
        id: 'ceviche-mix', dish: 'scoop', block: 'hers', where: 'hers',
        title: 'Mix the ceviche',
        body: [
          'Take the ceviche bowl and the fish out of the fridge.',
          'Add the fish and onion to the ceviche bowl.',
          'Add 2¼ teaspoons of olive oil and ¼ teaspoon of salt plus a [[pinch]].',
          'Cut the orange in half. Squeeze one half into a cup. Measure 1 tablespoon plus 1½ teaspoons of the juice into the bowl.',
          'Stir gently. Taste it on a chip. Flat or only sour? Add a [[pinch]] of salt, stir, and taste again. It can take 3 or 4 pinches.',
          'Cover. Back in the fridge. The avocado goes in at the very end.'
        ],
        need: ['Olive oil', 'Salt', 'Orange', 'Measuring spoons'],
        after: ['fish-drain', 'chop-tomato', 'chop-serrano', 'chop-cilantro', 'chop-olives'],
        notBefore: { anchor: 'dinner', mins: -120 },
        mins: 5
      },
      {
        id: 'slaw-toss', dish: 'cream', block: 'hers', where: 'hers',
        title: 'Dress the slaw',
        body: [
          'Shake the slaw dressing jar. Pour all of it over the vegetables in the slaw bowl.',
          'Toss with tongs or two spoons until everything is coated.',
          'Add ½ teaspoon of salt and ¼ teaspoon of black pepper. Toss. Taste a forkful. Flat? Add a [[pinch]] more salt and toss again.',
          'Cover. Fridge.'
        ],
        need: ['Slaw dressing jar', 'Salt', 'Pepper'],
        after: ['slaw-dressing', 'chop-cabbage', 'chop-slaw-rest'],
        notBefore: { anchor: 'dinner', mins: -120 },
        mins: 4
      },
      {
        id: 'table', dish: 'day', block: 'hers', where: 'hers', optional: true,
        title: 'Set the table',
        body: [
          'Plates, forks, napkins, glasses.',
          'Serving bowls and spoons for the beans, rice and slaw.',
          'Put a serving bowl and a sheet of foil next to the stove for the shrimp.'
        ],
        mins: 10
      },

      /* ================================= THE LAST HOUR ================================= */
      {
        id: 'rice-ready', dish: 'milky', block: 'final', where: 'hers', kind: 'checklist',
        title: 'Line up everything for the rice',
        body: ['Put these next to the stove. Once the rice starts you cannot leave the pan for 10 minutes.'],
        items: [
          'Saucepan and its lid',
          'Wooden spoon and a fork',
          'Vegetable oil and measuring spoons',
          'Rice bag',
          'Purée jar, from the fridge',
          'Broth jar, from the fridge',
          'Bowl of serranos and parsley'
        ],
        after: ['rice-kit'],
        notBefore: { anchor: 'dinner', mins: -68 },
        mins: 2
      },
      {
        id: 'rice-toast', dish: 'milky', block: 'final', where: 'hers',
        title: 'Toast the rice',
        body: [
          'Saucepan on the smallest burner, on [[heat|medium]]. Add 2¼ teaspoons of vegetable oil. Let it heat for 1 minute.',
          'Pour in the rice from the bag. Start the timer.',
          'Stir almost the whole time.'
        ],
        need: ['Saucepan', 'Vegetable oil', 'Rice bag', 'Wooden spoon'],
        look: 'The grains turn from see-through to [[milky|chalky white]].',
        tip: 'Not chalky white when the timer ends? Keep stirring for up to 1 more minute.',
        after: ['rice-kit', 'rice-ready'],
        notBefore: { anchor: 'dinner', mins: -65 },
        timer: { secs: 330, label: 'Rice toasting' },
        mins: 1.5
      },
      {
        id: 'rice-puree-in', dish: 'milky', block: 'final', where: 'hers',
        title: 'Add the tomato purée',
        body: [
          'Pour in the purée jar. It will spit, so stand back.',
          'Start the timer. Keep stirring.'
        ],
        need: ['Purée jar'],
        look: 'Thick and fairly dry, like wet sand.',
        after: ['rice-toast', 'rice-puree'],
        timer: { secs: 150, label: 'Purée cooking down' },
        mins: 0.5
      },
      {
        id: 'rice-boil', dish: 'milky', block: 'final', where: 'hers',
        title: 'Add the broth and bring it to a boil',
        body: [
          'Pour in the broth jar. Burner up to high. It boils in about 1 minute. Stay right there.',
          'When it reaches a [[boil|full boil]], stir in the serranos and parsley from the small bowl.',
          'Scrape down any rice stuck to the sides of the pan.',
          'Go straight to the next step.'
        ],
        need: ['Broth jar', 'Bowl of serranos and parsley', 'Lid'],
        tip: 'Optional: stir in a handful of shredded carrots too.',
        after: ['rice-puree-in', 'chop-rice'],
        mins: 2
      },
      {
        id: 'rice-cover', dish: 'milky', block: 'final', where: 'hers',
        title: 'Lid on. Lowest heat.',
        body: [
          'Put the lid on tight.',
          'Turn the burner to its lowest setting.',
          'Electric or glass stove? It stays hot. Move the pan to another burner set to its lowest setting.',
          'Tap Done. A 20-minute timer starts.',
          'Do not lift the lid until it ends.'
        ],
        tip: 'Lid loose? Lay a sheet of foil over the pan and press the lid down on top.',
        after: ['rice-boil'],
        wait: { id: 'rice', mins: 20, label: 'Rice cooking', attended: true, urgent: true },
        mins: 1
      },
      {
        id: 'shrimp-dry', dish: 'pink', block: 'final', where: 'hers',
        title: 'Dry the shrimp',
        body: [
          'Take the marinade jar out of the fridge. Leave it on the counter. The oil in it turns thick and cloudy in the cold. That is normal.',
          'Count out half the shrimp. That is ½ pound. Put the rest back in the fridge.',
          'Pinch off any tails.',
          '[[pat-dry|Pat them dry]] with paper towels. Put them in a medium bowl.',
          'Cover the bowl. Fridge.'
        ],
        need: ['Shrimp', 'Paper towels', 'Medium bowl', 'Marinade jar'],
        warn: 'Raw shrimp. Wash your hands with soap after. Wipe the counter and the fridge handle.',
        notBefore: { anchor: 'dinner', mins: -50 },
        mins: 3
      },
      {
        id: 'beans-reheat', dish: 'patron', block: 'final', where: 'hers',
        title: 'Warm the beans',
        body: [
          'Pour the beans into a pot. Already in a pot on the stove? Leave them there.',
          'Lid on. Burner on [[heat|medium-low]].',
          'Stir them each time you are at the stove, so the bottom does not stick.',
          'Too thick? Add a splash of water.'
        ],
        need: ['Bean tub', 'Pot with a lid', 'Spoon'],
        look: 'By dinner they are steaming hot, with bubbles all over.',
        after: ['beans-off'],
        notBefore: { anchor: 'dinner', mins: -52 },
        mins: 2
      },
      {
        id: 'corn-oil', dish: 'elote', block: 'final', where: 'hers',
        title: 'Broiler on. Oil the corn.',
        body: [
          'Is the oven rack about 6 inches below the top? If not, move it now, before the oven is hot.',
          'Then turn the oven [[broiler]] to high.',
          'Turn on the fan over the stove.',
          'Drizzle 2 tablespoons of vegetable oil over the 4 ears on the pan.',
          'Sprinkle on 1 teaspoon of salt and 1 teaspoon of black pepper.',
          'Roll the ears around so they are coated.',
          'The broiler needs a few minutes to get hot. The guide tells you when the corn goes in.'
        ],
        need: ['Vegetable oil', 'Salt', 'Pepper'],
        after: ['prep-corn'],
        notBefore: { anchor: 'dinner', mins: -47 },
        mins: 3
      },
      {
        id: 'corn-in', dish: 'elote', block: 'final', where: 'hers',
        title: 'Corn under the broiler',
        body: [
          'Slide the pan under the broiler.',
          'Tap Done as soon as it is in. A 12-minute timer starts.',
          'Every 3 minutes the guide tells you to turn the corn.',
          'To turn it: pull the rack part-way out with the oven mitt. Give each ear a quarter turn with tongs. Slide it back.',
          'The time is an estimate. You want dark brown and black spots on every side.'
        ],
        need: ['Tongs', 'Oven mitt'],
        warn: 'Do not reach in under the broiler. Pull the rack out to you.',
        after: ['corn-oil'],
        notBefore: { anchor: 'dinner', mins: -40 },
        wait: { id: 'corn', mins: 12, label: 'Corn broiling', attended: true, urgent: true, laps: [3, 6, 9], lapLabel: 'Turn the corn' },
        mins: 1
      },
      {
        id: 'set-out', dish: 'day', block: 'final', where: 'hers',
        title: 'Put the snacks and sauces out',
        body: [
          'Chips, tostadas and saltines on the table.',
          'Put the jar of pickled onions on the table with a clean fork.',
          'Pink sauce on the table with a spoon.',
          'Lime wedges on the table.',
          'Put the corn sauce tub, a spoon, the plate of cotija and a sheet of foil next to the stove.'
        ],
        notBefore: { anchor: 'dinner', mins: -39 },
        mins: 4
      },
      {
        id: 'rice-fluff', dish: 'milky', block: 'final', where: 'hers',
        title: 'Fluff the rice',
        body: [
          'Burner off.',
          'Lift the lid. [[fluff|Drag a fork through the rice]] to separate the grains.',
          'Lid back on. Leave it.',
          'Stir the beans while you are at the stove. Bubbling all over? Turn them down to [[heat|low]].'
        ],
        look: 'No liquid left. The grains are tender.',
        tip: 'Still wet at the bottom, or hard when you bite a grain? Lid back on. Lowest heat. 5 more minutes. Pan dry and grains still hard? Sprinkle on a splash of water first.',
        after: ['rice-cover'],
        afterWait: 'rice',
        mins: 1
      },
      {
        id: 'corn-out', dish: 'elote', block: 'final', where: 'hers',
        title: 'Take the corn out and dress it',
        body: [
          'Look first. Dark brown and black spots on every side? Then it is ready.',
          'No dark spots yet? Leave it in. Turn it every 2 minutes, for up to 6 more minutes.',
          'Take the pan out with the oven mitt. Turn the broiler off.',
          'Set the pan on a free part of the stovetop or on a folded dry towel. Never on a bare counter.',
          'Spoon the corn sauce over each hot ear and spread it around.',
          'Sprinkle the cotija all over and press it on.',
          'Dust lightly with chipotle powder if you like.',
          '[[tent|Tent the pan loosely with foil]] to keep it warm.'
        ],
        need: ['Corn sauce tub', 'Plate of cotija', 'Foil', 'Oven mitt'],
        look: 'Plump, shiny kernels with dark brown and black spots on every side. Your corn is white, so it will not turn yellow.',
        after: ['corn-in'],
        afterWait: 'corn',
        mins: 4
      },
      {
        id: 'shrimp-marinate', dish: 'pink', block: 'final', where: 'hers',
        title: 'Shrimp into the marinade',
        body: [
          'Take the bowl of shrimp out of the fridge.',
          'Shake the marinade jar hard. Pour it over the shrimp. Scrape out what sticks with a spoon.',
          'Stir with the spoon until every shrimp is coated. The spoon goes in the sink.',
          'Leave the bowl on the counter.',
          'They sit while the skillet heats, about 10 minutes in all. Never more than 20: the lime starts to cook them.'
        ],
        need: ['Bowl of shrimp', 'Marinade jar', 'Spoon'],
        after: ['shrimp-dry', 'marinade', 'corn-out'],
        notBefore: { anchor: 'dinner', mins: -21 },
        wait: { id: 'marinade', mins: 5, label: 'Shrimp marinating', attended: false, urgent: false, max: 20 },
        mins: 1
      },
      {
        id: 'slaw-drain', dish: 'cream', block: 'final', where: 'hers',
        title: 'Drain the slaw',
        body: [
          'Take the slaw out of the fridge.',
          'Tip the bowl over the sink and pour off the liquid at the bottom.',
          'Toss once more. Put it on the table.'
        ],
        after: ['slaw-toss', 'shrimp-marinate'],
        notBefore: { anchor: 'dinner', mins: -20 },
        mins: 2
      },
      {
        id: 'finish-ceviche', dish: 'scoop', block: 'final', where: 'hers',
        title: 'Add the avocado to the ceviche',
        body: [
          'Take the ceviche out of the fridge.',
          'Lay the avocado on the cutting board. Do not hold it in your hand while you cut.',
          '[[avocado|Cut into it the long way until the knife hits the pit. Roll it so the cut goes all the way around.]] Twist the two halves apart.',
          'Take the half with no pit. Lay it on the board, skin side down. With a table knife, cut lines through the flesh one way, then the other way. Stop at the skin.',
          'Scoop the cubes out with a spoon. [[fold|Fold]] them gently into the ceviche.',
          'Put the cilantro leaves on top. Take it to the table.'
        ],
        need: ['Avocado', 'Cutting board and knife', 'Table knife', 'Spoon'],
        tip: 'Brown or stringy inside? Use the second avocado.',
        warn: 'Keep the avocado on the cutting board while you cut. Never cut it in your hand.',
        after: ['ceviche-mix', 'shrimp-marinate'],
        notBefore: { anchor: 'dinner', mins: -18 },
        mins: 3
      },
      {
        id: 'skillet-hot', dish: 'pink', block: 'final', where: 'hers',
        title: 'Get the skillet very hot',
        body: [
          'First warm the shrimp serving bowl. Fill it with hot tap water. Pour the water out and dry the bowl. Put it next to the stove with a sheet of foil.',
          'Turn on the fan over the stove. Open a window if you can.',
          'Cast-iron skillet on high heat. Add 1½ teaspoons of olive oil.',
          'Start the timer. Stay at the stove and watch the oil.',
          'If the oil starts to smoke before the timer ends, skip the timer and start the shrimp.'
        ],
        need: ['Cast-iron skillet', 'Olive oil', 'Tongs', 'Bowl of shrimp', 'Serving bowl and foil', 'Oven mitt'],
        look: 'The oil [[shimmer|shimmers]] and moves like water.',
        tip: 'Thick smoke before the shrimp go in? Slide the pan off the burner for 30 seconds. Use the oven mitt.',
        warn: 'The handle gets as hot as the pan. Touch it only with the oven mitt, even after the burner is off.',
        after: ['shrimp-marinate'],
        afterWait: 'marinade',
        timer: { secs: 180, label: 'Skillet heating' },
        mins: 1
      },
      {
        id: 'shrimp-sear-1', dish: 'pink', block: 'final', where: 'hers',
        title: 'Sear the shrimp: side one',
        body: [
          'Lift the shrimp out of the marinade with tongs. Lay them in the skillet in one layer.',
          'Start at one side and work around the pan.',
          'Leave the liquid behind in the bowl. Do not use it for anything. Raw shrimp sat in it. The bowl goes in the sink.',
          'Start the timer. Do not move them. [[sear|This is called searing.]]'
        ],
        need: ['Tongs'],
        warn: 'It will smoke and spit. That is normal. The chile smoke can make you cough.',
        after: ['skillet-hot'],
        timer: { secs: 60, label: 'Shrimp, side one' },
        mins: 0.5
      },
      {
        id: 'shrimp-sear-2', dish: 'pink', block: 'final', where: 'hers',
        title: 'Flip the shrimp: side two',
        body: [
          'Turn every shrimp over with the tongs, in the order you laid them down.',
          'Start the timer.',
          'When it ends, lift out the thickest shrimp and cut it in half.',
          'White all the way through? Burner off. Move them all to the warm serving bowl. Cover it with foil.',
          'Gray or see-through in the middle? Give them 30 seconds more, then check again.',
          'Leave the skillet on the stove. It stays hot for a long time.'
        ],
        need: ['Tongs', 'Knife', 'Warm serving bowl and foil'],
        look: 'Pink outside, [[opaque|white inside]], curled into a [[c-shape|loose C]].',
        warn: 'Cooked shrimp go into a clean bowl. Never the bowl the raw shrimp were in.',
        after: ['shrimp-sear-1'],
        timer: { secs: 60, label: 'Shrimp, side two' },
        mins: 1
      },
      {
        id: 'tortillas', dish: 'pink', block: 'final', where: 'hers',
        title: 'Warm the tortillas',
        body: [
          'Wrap 6 tortillas in a [[damp-towel|damp kitchen towel]].',
          'Microwave for 30 to 45 seconds.',
          'Keep them wrapped. Take them to the table.'
        ],
        look: 'Warm and soft. They bend without cracking.',
        tip: 'No microwave? Warm each one in a dry skillet, about 30 seconds per side.',
        after: ['shrimp-sear-2'],
        notBefore: { anchor: 'dinner', mins: -6 },
        mins: 2
      },
      {
        id: 'finish-hot', dish: 'day', block: 'final', where: 'hers',
        title: 'Last touches',
        body: [
          'The beans must be steaming and bubbling. Not yet? Turn the burner up to [[heat|medium]]. Stir until they are.',
          'Stir the bowl of chopped cilantro into the beans.',
          'Pull the 2 serranos out of the rice.',
          'Check that every burner and the oven are off.',
          'Beans, rice, corn and shrimp to the table.'
        ],
        after: ['beans-reheat', 'rice-fluff', 'corn-out', 'shrimp-sear-2'],
        notBefore: { anchor: 'dinner', mins: -5 },
        mins: 2
      },
      {
        id: 'dinner', dish: 'day', block: 'final', where: 'hers',
        title: 'Dinner is served',
        body: [
          'Build each taco: shrimp, a pile of slaw, a drizzle of pink sauce, a squeeze of lime.',
          'Scoop the ceviche with tostadas, chips or saltines.',
          'Pickled onions go on everything.',
          'Put leftover ceviche back in the fridge right after dinner. Throw it away if it sat out for more than 2 hours.'
        ],
        after: ['finish-ceviche', 'finish-hot', 'tortillas', 'shrimp-sear-2', 'corn-out', 'set-out', 'slaw-drain'],
        notBefore: { anchor: 'dinner', mins: 0 },
        mins: 0
      }
    ],

    /* -------------------------------------------------------------- pack lists */
    pack: {
      cooler: [
        { id: 'c-ice', label: 'Ice packs', note: 'on the bottom' },
        { id: 'c-fish', label: 'Halibut', note: 'in a sealed zip bag, right on the ice' },
        { id: 'c-shrimp', label: 'Shrimp', note: 'in a sealed zip bag, right on the ice' },
        { id: 'c-beans', label: 'Bean tub', ifDone: 'beans-pot' },
        { id: 'c-beans-raw', label: 'Beans not started: the beans (drained if they soaked) in the bean tub, and the stew pork', ifNotDone: 'beans-pot' },
        { id: 'c-sofrito', label: 'Spare tub of tomato mix and bacon (for the beans)', note: 'in the fridge since this morning', ifDone: 'sofrito-tomato', ifNotDone: 'beans-add' },
        { id: 'c-sofrito-raw', label: 'For the beans: bacon, poblano, diced white onion (or 1 wedge), drained tomatoes', note: 'whatever state they are in. Plus 1 tablespoon of bacon fat from the mug if the bacon is fried', ifNotDone: 'sofrito-tomato' },
        { id: 'c-onions', label: 'Onion jar', ifDone: 'onion-jar' },
        { id: 'c-pink', label: 'Pink sauce tub', ifDone: 'pink-sauce' },
        { id: 'c-pink-raw', label: 'Sour cream (for the pink sauce)', ifNotDone: 'pink-sauce' },
        { id: 'c-limejar', label: 'Ceviche lime jar', ifDone: 'limes' },
        { id: 'c-limesauce', label: 'Sauce lime jar', note: 'bring it even if it looks almost empty', ifDone: 'limes' },
        { id: 'c-dressing', label: 'Slaw dressing jar', ifDone: 'slaw-dressing' },
        { id: 'c-dressing-raw', label: 'Mayonnaise and Greek yogurt (for the slaw dressing)', ifNotDone: 'slaw-dressing' },
        { id: 'c-cornsauce', label: 'Corn sauce tub', ifDone: 'corn-sauce' },
        { id: 'c-cornsauce-raw', label: 'Sour cream and mayonnaise (for the corn sauce)', ifNotDone: 'corn-sauce' },
        { id: 'c-marinade', label: 'Marinade jar', ifDone: 'marinade' },
        { id: 'c-puree', label: 'Purée jar', ifDone: 'rice-puree' },
        { id: 'c-broth', label: 'Broth jar', ifDone: 'rice-kit' },
        { id: 'c-cotija', label: 'Cotija cheese' },
        { id: 'c-onion-white', label: 'White onion wedge, wrapped', note: 'for the ceviche' },
        { id: 'c-onion-red', label: 'Half red onion, wrapped', note: 'for the slaw' },
        { id: 'c-cilantro', label: 'Cilantro' },
        { id: 'c-parsley', label: 'Parsley' },
        { id: 'c-scallions', label: 'Scallions (the bunch labeled green onions)' },
        { id: 'c-carrots', label: 'Bag of shredded carrots' }
      ],
      bag: [
        { id: 'b-rice', label: 'Rice bag', ifDone: 'rice-kit' },
        { id: 'b-rice-raw', label: 'Rice and chicken broth', ifNotDone: 'rice-kit' },
        { id: 'b-tomatoes', label: 'Tomatoes', note: 'all 3' },
        { id: 'b-serranos', label: 'Serranos', note: 'all 4' },
        { id: 'b-jalapeno', label: 'Jalapeño' },
        { id: 'b-cabbage-g', label: 'Green cabbage' },
        { id: 'b-cabbage-p', label: 'Purple cabbage' },
        { id: 'b-limes', label: 'The 4 whole limes', note: '2 become wedges', ifDone: 'limes' },
        { id: 'b-orange', label: 'Orange' },
        { id: 'b-avocados', label: 'Avocados', note: 'both' },
        { id: 'b-corn', label: 'Corn', note: '4 ears' },
        { id: 'b-olives', label: 'Jar of green olives' },
        { id: 'b-tortillas', label: 'Corn tortillas' },
        { id: 'b-chips', label: 'Tortilla chips' },
        { id: 'b-tostadas', label: 'Tostadas' },
        { id: 'b-saltines', label: 'Saltines' },
        { id: 'b-olive-oil', label: 'Olive oil' },
        { id: 'b-veg-oil', label: 'Vegetable oil' },
        { id: 'b-salt', label: 'Salt' },
        { id: 'b-pepper', label: 'Black pepper' },
        { id: 'b-chipotle', label: 'Chipotle powder' },
        { id: 'b-sriracha', label: 'Sriracha', ifNotDone: 'pink-sauce' },
        { id: 'b-sugar', label: 'Sugar, ground cumin and an empty 2-cup jar', note: 'for the slaw dressing', ifNotDone: 'slaw-dressing' },
        { id: 'b-limes-all', label: 'All 15 limes, the lime squeezer, the fine grater or peeler', note: 'and 2 small jars for the juice', ifNotDone: 'limes' },
        { id: 'b-garlic', label: 'Garlic and the marinade jar', note: 'the jar may already hold the lime zest', ifNotDone: 'marinade' },
        { id: 'b-onion-kit', label: 'For the pickled onions: the red onions, vinegar, oregano, allspice, peppercorns, bay leaf, quart jar', ifNotDone: 'onion-jar' },
        { id: 'b-tomato-can', label: 'Can of plain diced tomatoes and a can opener', note: 'for the beans', ifNotDone: 'tomato-drain' },
        { id: 'b-beer', label: '1 bottle of beer', note: 'for the beans', ifNotDone: 'beans-pot' }
      ],
      gear: [
        { id: 'g-skillet', label: '12-inch cast-iron skillet' },
        { id: 'g-saucepan', label: 'Saucepan with a tight lid that holds 6 to 8 cups', note: 'rice' },
        { id: 'g-pot', label: 'Medium pot with its lid', note: 'for the beans. The big pot may still be full.' },
        { id: 'g-pan', label: 'Sheet pan' },
        { id: 'g-foil', label: 'Foil' },
        { id: 'g-bowls-l', label: '2 large bowls' },
        { id: 'g-bowls-m', label: '3 medium bowls', note: 'one glass or stainless steel, one kept clean for the cooked shrimp' },
        { id: 'g-bowls-s', label: '3 small bowls' },
        { id: 'g-strainer', label: 'Strainer' },
        { id: 'g-board', label: 'Cutting board' },
        { id: 'g-knife', label: 'Sharp knife', note: 'wrapped in a towel' },
        { id: 'g-tongs', label: 'Tongs' },
        { id: 'g-spoon', label: 'Wooden spoon' },
        { id: 'g-measure', label: 'Measuring spoons and all your measuring cups' },
        { id: 'g-towels', label: 'Paper towels and 2 kitchen towels' },
        { id: 'g-mitt', label: 'Oven mitt' },
        { id: 'g-charger', label: 'Phone charger' }
      ]
    },

    /* -------------------------------------------------------------- containers */
    containers: {
      home: [
        { name: 'Onion jar', size: '1 quart (4 cups), with a lid', holds: 'Pickled onions' },
        { name: 'Slaw dressing jar', size: '1 pint (2 cups), with a lid', holds: 'Slaw dressing' },
        { name: 'Ceviche lime jar', size: 'About 1 cup, with a lid', holds: '¾ cup of lime juice' },
        { name: 'Sauce lime jar', size: 'About 1 cup, with a lid', holds: 'The rest of the lime juice, for the slaw dressing, corn sauce and marinade' },
        { name: 'Marinade jar', size: 'About 1 cup, with a lid', holds: 'Shrimp marinade' },
        { name: 'Purée jar', size: 'About 2 cups, with a lid', holds: 'Tomato purée for the rice' },
        { name: 'Broth jar', size: 'About 2 cups, with a lid', holds: 'Broth and salt for the rice' },
        { name: 'Pink sauce tub', size: 'About 1 cup, with a lid', holds: 'Pink sauce' },
        { name: 'Corn sauce tub', size: 'About 2 cups, with a lid', holds: 'Sauce for the corn' },
        { name: 'Spare tub', size: 'About 2 cups, with a lid', holds: 'Tomato mix and bacon, only if the beans are not finished at home' },
        { name: 'Bean tub', size: '2 quarts (8 cups), with a lid', holds: 'The beans and their broth' },
        { name: 'Zip bag', size: 'Sandwich size', holds: '¾ cup of rice' },
        { name: '2 more zip bags', size: 'Quart or gallon size', holds: 'The halibut and the shrimp, sealed, for the cooler' },
        { name: 'Pork bowl', size: 'Small bowl', holds: 'Raw pork pieces, until the bean pot is filled' },
        { name: 'Onion and poblano bowl', size: 'Small bowl', holds: 'Diced white onion and chopped poblano, until they are fried' },
        { name: 'Mug', size: 'Heatproof', holds: 'Hot bacon fat. It stays home.' }
      ],
      hers: [
        { name: 'Ceviche bowl', size: 'Large', holds: 'Tomato, serrano, cilantro, olives. Later the fish.' },
        { name: 'Slaw bowl', size: 'Large', holds: 'All the slaw vegetables' },
        { name: 'Fish bowl', size: 'Medium, glass or stainless steel', holds: 'Onion, fish and lime juice' },
        { name: 'Shrimp bowl', size: 'Medium', holds: 'Shrimp and marinade' },
        { name: 'Small bowl (bean cilantro)', size: 'Small', holds: 'Cilantro for the beans' },
        { name: 'Small bowl (rice add-ins)', size: 'Small', holds: 'Serranos and parsley for the rice' },
        { name: 'Small bowl (lime wedges)', size: 'Small', holds: 'Lime wedges' },
        { name: 'Plate', size: 'Dinner plate', holds: 'Crumbled cotija' },
        { name: 'Serving bowl', size: 'Medium, with a sheet of foil', holds: 'Cooked shrimp' }
      ]
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
  else root.PLAN = PLAN;
})(typeof self !== 'undefined' ? self : this);
