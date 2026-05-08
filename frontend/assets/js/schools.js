// Shared school directory + helpers for inferring campus from email.
// Keeps explore/signup in sync with a single list.

(function () {
  function normalize(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function cleanDomain(domain) {
    const d = normalize(domain);
    if (!d) return '';
    return d.replace(/^@/, '').replace(/^www\./, '');
  }

  function domainFromEmail(email) {
    const e = normalize(email);
    const at = e.lastIndexOf('@');
    if (at <= -1) return '';
    return cleanDomain(e.slice(at + 1));
  }

  // Minimal, extendable list (add more schools as needed).
  // Note: domains are the key for email → school matching.
  const SCHOOLS = [
    { name: 'UCLA', aliases: ['University of California Los Angeles'], domains: ['ucla.edu'], center: [34.0689, -118.4452] },
    { name: 'USC', aliases: ['University of Southern California'], domains: ['usc.edu'], center: [34.0224, -118.2851] },
    { name: 'UC Irvine', aliases: ['UCI', 'University of California Irvine'], domains: ['uci.edu'], center: [33.6405, -117.8443] },
    { name: 'UC San Diego', aliases: ['UCSD', 'University of California San Diego'], domains: ['ucsd.edu'], center: [32.8801, -117.2340] },
    { name: 'San Diego State University', aliases: ['SDSU'], domains: ['sdsu.edu'], center: [32.7757, -117.0719] },
    { name: 'Cal State Fullerton', aliases: ['CSUF', 'California State University Fullerton'], domains: ['fullerton.edu'], center: [33.8823, -117.8850] },
    { name: 'Cal State Long Beach', aliases: ['CSULB', 'California State University Long Beach'], domains: ['csulb.edu'], center: [33.7838, -118.1141] },
    { name: 'Cal Poly Pomona', aliases: ['CPP', 'California State Polytechnic University Pomona'], domains: ['cpp.edu'], center: [34.0575, -117.8218] },
    { name: 'Cal State LA', aliases: ['CSULA', 'California State University Los Angeles'], domains: ['calstatela.edu'], center: [34.0661, -118.1682] },
    { name: 'UC Berkeley', aliases: ['UCB', 'University of California Berkeley'], domains: ['berkeley.edu'], center: [37.8719, -122.2585] },
    { name: 'UC Davis', aliases: ['UCD', 'University of California Davis'], domains: ['ucdavis.edu'], center: [38.5382, -121.7617] },
    { name: 'UC Santa Barbara', aliases: ['UCSB', 'University of California Santa Barbara'], domains: ['ucsb.edu'], center: [34.4139, -119.8489] },
    { name: 'UC Santa Cruz', aliases: ['UCSC', 'University of California Santa Cruz'], domains: ['ucsc.edu'], center: [36.9916, -122.0583] },
    { name: 'UC Riverside', aliases: ['UCR', 'University of California Riverside'], domains: ['ucr.edu'], center: [33.9737, -117.3281] },
    { name: 'UC Merced', aliases: ['UCM', 'University of California Merced'], domains: ['ucmerced.edu'], center: [37.3644, -120.4240] },
    { name: 'Stanford University', aliases: ['Stanford'], domains: ['stanford.edu'], center: [37.4275, -122.1697] },
    { name: 'California Institute of Technology', aliases: ['Caltech'], domains: ['caltech.edu'], center: [34.1377, -118.1253] },
    { name: 'San Jose State University', aliases: ['SJSU'], domains: ['sjsu.edu'], center: [37.3352, -121.8811] },
    { name: 'San Francisco State University', aliases: ['SFSU'], domains: ['sfsu.edu'], center: [37.7219, -122.4782] },
    { name: 'Cal Poly San Luis Obispo', aliases: ['Cal Poly SLO', 'California Polytechnic State University'], domains: ['calpoly.edu'], center: [35.3004, -120.6625] },
    { name: 'California State University Northridge', aliases: ['CSUN'], domains: ['csun.edu'], center: [34.2400, -118.5281] },
    { name: 'Chapman University', aliases: ['Chapman'], domains: ['chapman.edu'], center: [33.7933, -117.8517] },
    { name: 'Loyola Marymount University', aliases: ['LMU'], domains: ['lmu.edu'], center: [33.9698, -118.4162] },
    { name: 'University of San Francisco', aliases: ['USF'], domains: ['usfca.edu'], center: [37.7757, -122.4511] },
    { name: 'Santa Clara University', aliases: ['SCU'], domains: ['scu.edu'], center: [37.3496, -121.9390] },
    { name: 'Pepperdine University', aliases: ['Pepperdine'], domains: ['pepperdine.edu'], center: [34.0395, -118.7083] },

    // Washington
    { name: 'University of Washington', aliases: ['UW'], domains: ['uw.edu'], center: [47.6553, -122.3035] },
    { name: 'Washington State University', aliases: ['WSU'], domains: ['wsu.edu'], center: [46.7298, -117.1817] },

    // Oregon
    { name: 'University of Oregon', aliases: ['UO'], domains: ['uoregon.edu'], center: [44.0450, -123.0726] },
    { name: 'Oregon State University', aliases: ['OSU'], domains: ['oregonstate.edu'], center: [44.5638, -123.2794] },

    // Arizona
    { name: 'Arizona State University', aliases: ['ASU'], domains: ['asu.edu'], center: [33.4242, -111.9281] },
    { name: 'University of Arizona', aliases: ['UArizona', 'UA'], domains: ['arizona.edu'], center: [32.2319, -110.9501] },

    // Nevada
    { name: 'University of Nevada Las Vegas', aliases: ['UNLV'], domains: ['unlv.edu'], center: [36.1070, -115.1417] },
    { name: 'University of Nevada Reno', aliases: ['UNR'], domains: ['unr.edu'], center: [39.5383, -119.8170] },

    // Colorado
    { name: 'University of Colorado Boulder', aliases: ['CU Boulder'], domains: ['colorado.edu'], center: [40.0076, -105.2659] },
    { name: 'Colorado State University', aliases: ['CSU'], domains: ['colostate.edu'], center: [40.5734, -105.0865] },
    { name: 'University of Denver', aliases: ['DU'], domains: ['du.edu'], center: [39.6780, -104.9615] },

    // Utah
    { name: 'University of Utah', aliases: ['U of U'], domains: ['utah.edu'], center: [40.7649, -111.8421] },
    { name: 'Brigham Young University', aliases: ['BYU'], domains: ['byu.edu'], center: [40.2518, -111.6493] },
  ];

  const byDomain = new Map();
  const byName = new Map();

  for (const school of SCHOOLS) {
    (school.domains || []).forEach((d) => byDomain.set(cleanDomain(d), school));
    byName.set(normalize(school.name), school);
    (school.aliases || []).forEach((a) => byName.set(normalize(a), school));
  }

  function inferSchoolFromEmail(email) {
    const domain = domainFromEmail(email);
    if (!domain) return null;
    if (byDomain.has(domain)) return byDomain.get(domain);

    // Best-effort: try suffix match for subdomains (e.g. dept.school.edu).
    for (const [known, school] of byDomain.entries()) {
      if (domain === known || domain.endsWith(`.${known}`)) return school;
    }
    return null;
  }

  function centerForCampusName(campusName) {
    const normalized = normalize(campusName);
    if (!normalized) return null;
    const direct = byName.get(normalized);
    if (direct?.center) return direct.center;

    // Fuzzy: partial substring match across canonical+aliases.
    for (const [key, school] of byName.entries()) {
      if (normalized.includes(key) || key.includes(normalized)) return school.center || null;
    }
    return null;
  }

  function allSchoolDisplayNames() {
    return SCHOOLS.map((s) => s.name).filter(Boolean);
  }

  window.SchoolDirectory = {
    SCHOOLS,
    inferSchoolFromEmail,
    centerForCampusName,
    allSchoolDisplayNames,
  };
})();

