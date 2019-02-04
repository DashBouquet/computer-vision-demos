export default [
  {
    description: "Open hand recognition",
    modelName: "hands2-93-0.9880",
    labels: ["close", "open"],
    explainers: ["classes/closed.jpg", "classes/opened.jpg"]
  },

  {
    description: "Open hand & fingers recognition (very raw)",
    modelName: 'handsMulti-47-0.8496',
    labels: ['0','1','2','3','4','5','6','7','8','9','q','w','x','z'],
    explainers: [
      "classes/0.jpg", 
      "classes/1.jpg", 
      "classes/2.jpg", 
      "classes/3.jpg",
      "classes/4.jpg",
      "classes/5.jpg",
      "classes/6.jpg",
      "classes/7.jpg",
      "classes/8.jpg",
      "classes/9.jpg",
      "classes/q.jpg",
      "classes/w.jpg",
      "classes/x.jpg",]
  }
];
