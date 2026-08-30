/**
 * The jams.
 *
 * Every one of these was built at random and then handed to the solver, which
 * found the shortest way out of it. Only the ones it could clear are here, and
 * `best` is the fewest moves that will ever do it -- not a guess, and not a
 * target somebody eyeballed. The tests re-solve all of them, so a jam that
 * cannot be cleared can never reach a child.
 *
 * A lot is thirty-six characters read left to right, top to bottom. A dot is
 * empty tarmac, X is the red car, and every other letter is a vehicle two or
 * three squares long. Which way each one lies is worked out from its shape,
 * so there is nothing to keep in step.
 *
 * To add one: write the line, and run the tests. They will tell you whether it
 * can be done and how few moves it takes.
 */
(function () {
  "use strict";

  window.ParkingLevels = [
    { id: "l1", name: "Just squeeze past", best: 4,
      lot: ".AJDHHIAJDBKIXX.BK..FFFKG.EE..G.CCC." },
    { id: "l2", name: "Two in the way", best: 4,
      lot: "HH.C....AC.GXXAC.GFF..EE.BD....BD..." },
    { id: "l3", name: "Shuffle along", best: 6,
      lot: "FIG.C.FIG.C.EXX.C.E.HHDD.BAA.K.B.JJK" },
    { id: "l4", name: "Round the back", best: 6,
      lot: "AAA...FGGBBBFXX.H..DDDH....ICCEEEI.." },
    { id: "l5", name: "Busy morning", best: 9,
      lot: "..EBBC..E..CXXE..C...FDD.A.F...A.F.." },
    { id: "l6", name: "The school run", best: 9,
      lot: "....AB..CCAB..XXAF..HG.FDDHGEE...II." },
    { id: "l7", name: "Everyone at once", best: 9,
      lot: "H.GGIIHFFF.BJXXAKBJ.CAK.J.CDD...C.EE" },
    { id: "l8", name: "Lorries everywhere", best: 9,
      lot: "IKKEE.IHHH.FD..XXFDJJB.F.GGBCC..AAA." },
    { id: "l9", name: "Think ahead", best: 13,
      lot: "GG.EE...A...XXA.DBC.A.DBC.FFD......." },
    { id: "l10", name: "The long way round", best: 13,
      lot: "KFF.HJK.I.HJXXID...GGDCCAAA.BB.EE..." },
    { id: "l11", name: "Boxed in", best: 13,
      lot: "..EE..KKBBBGXXHIDGJJHIDA..FFFACC...." },
    { id: "l12", name: "No easy way", best: 14,
      lot: ".FEEGG.F.BB.KXXD.HKCCD.HI.JAAHI.J..." },
    { id: "l13", name: "Rush hour", best: 22,
      lot: "JFFBB.J.GCCCXXG......E.IHHHEDI..AADI" },
    { id: "l14", name: "Gridlock", best: 23,
      lot: "..EEEHGG..FHXXB.FAIIBJ.AKCCJDDK....." },
    { id: "l15", name: "Total panic", best: 25,
      lot: "EEE.HA.KKGHAXXBG.AJ.BFIIJDDF..CC...." },
  ];
})();
