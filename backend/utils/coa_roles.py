"""Which chart-of-accounts accounts play which role in the financial reports.

Two charts are supported: the legacy 'N-NNNN' chart and the Accurate chart
(4-digit headers, 6-digit postable children, e.g. 1002 Piutang Dagang ->
100201). The Accurate chart is detected by the presence of account '1002'.
Reports ask this module instead of hard-coding account codes.
"""
from models.finance import Account

LEGACY_CASH = ('1-1000', '1-1010', '1-1020')
LEGACY_MFG_6XXX = ('6-1000', '6-2000', '6-3000', '6-3100', '6-3200', '6-4000')
ACCURATE_MATERIAL_CODES = ('500304', '500309', '500310')
ACCURATE_INTEREST_CODES = ('700002', '700003', '700005', '700006')


def is_accurate_coa():
    return Account.query.filter_by(account_code='1002').first() is not None


class CoaRoles:
    def __init__(self, accurate=None):
        self.accurate = is_accurate_coa() if accurate is None else accurate

    # ------------------------------------------------------------ balance sheet
    def cash(self, a):
        return bool(a.is_cash_bank) if self.accurate else a.account_code in LEGACY_CASH

    def receivable(self, a):
        c = a.account_code
        return c.startswith(('1002', '1003', '1004')) if self.accurate else c in ('1-1100', '1-1110')

    def inventory(self, a):
        c = a.account_code
        return c.startswith('1005') if self.accurate else c in ('1-1200', '1-1300', '1-1400', '1-1500')

    def prepaid(self, a):
        c = a.account_code
        return c.startswith(('1006', '1007')) if self.accurate else c == '1-1600'

    def fixed_cost(self, a):
        c = a.account_code
        return c.startswith(('1101', '1104', '1105')) if self.accurate else c == '1-2000'

    def accumulated_depreciation(self, a):
        c = a.account_code
        return c.startswith(('1102', '1103')) if self.accurate else c == '1-2100'

    def asset_classified(self, a):
        return (self.cash(a) or self.receivable(a) or self.inventory(a) or self.prepaid(a)
                or self.fixed_cost(a) or self.accumulated_depreciation(a))

    def payable(self, a):
        c = a.account_code
        return c.startswith('2000') if self.accurate else c == '2-1000'

    def short_term_debt(self, a):
        c = a.account_code
        return c.startswith('2002') if self.accurate else c == '2-1300'

    def long_term_debt(self, a):
        c = a.account_code
        return c.startswith(('2003', '2004', '2005')) if self.accurate else c == '2-2000'

    def retained(self, a):
        c = a.account_code
        return c.startswith('3100') if self.accurate else c in ('3-2000', '3-3000')

    # --------------------------------------------------------- income statement
    def sales_revenue(self, a):
        c = a.account_code
        return c.startswith('4000') if self.accurate else c == '4-1000'

    def sales_discount(self, a):
        c = a.account_code
        return c.startswith('4002') if self.accurate else c == '4-1200'

    def expense_bucket(self, a):
        """direct_materials | direct_labor | overhead | cogs_other | selling | admin | other | interest"""
        c = a.account_code
        if self.accurate:
            if c.startswith('5000'):
                return 'cogs_other'
            if c in ACCURATE_MATERIAL_CODES:
                return 'direct_materials'
            if c.startswith(('5001', '5002')) or c in ('500307', '500313'):
                return 'direct_labor'
            if c.startswith('5'):
                return 'overhead'
            if c.startswith('62') or c.startswith('71'):
                return 'admin'
            if c.startswith('6'):
                return 'selling'
            if c in ACCURATE_INTEREST_CODES:
                return 'interest'
            return 'other'
        if c == '5-1000':
            return 'cogs_other'
        if c == '5-1100':
            return 'direct_materials'
        if c in ('5-1200', '5-1210', '5-1220'):
            return 'direct_labor'
        if c.startswith('5-') or c in LEGACY_MFG_6XXX:
            return 'overhead'
        if c.startswith('8-1') or c.startswith('6-'):
            return 'selling'
        if c.startswith('9-'):
            return 'interest' if c == '9-1000' else 'other'
        return 'admin'

    # ------------------------------------------------------------ single codes
    @property
    def control_codes(self):
        """AR/AP control accounts that standalone cash entries must not touch."""
        return {'1-1100', '1-1110', '2-1000', '2-1050'} if not self.accurate else None

    def is_control(self, a):
        c = a.account_code
        if self.accurate:
            return c.startswith(('1002', '2000', '2007'))
        return c in self.control_codes

    def receivable_control(self, a):
        c = a.account_code
        return c.startswith('1002') if self.accurate else c == '1-1100'

    def payable_control(self, a):
        return self.payable(a)

    def factory_overhead_account(self):
        return Account.query.filter_by(account_code='500305' if self.accurate else '5-1300').first()

    def direct_labor_wage_accounts(self):
        codes = ('500106', '500115') if self.accurate else ('5-1210', '5-1220')
        wage = Account.query.filter_by(account_code=codes[0]).first()
        allowance = Account.query.filter_by(account_code=codes[1]).first()
        return wage, allowance

    def fx_account_code(self):
        return '700011' if self.accurate else '9-8000'

    def ppn_masukan_code(self):
        return '100611' if self.accurate else '1-1700'

    def opening_stock_code(self):
        return '300001' if self.accurate else '3-4000'
